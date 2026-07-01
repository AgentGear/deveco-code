/** @jsxImportSource @opentui/solid */
import type { TuiPlugin, TuiPluginApi, TuiRouteCurrent } from "@opencode-ai/plugin/tui"
import type { SnapshotFileDiff, VcsFileDiff } from "@opencode-ai/sdk/v2"
import {
  TextAttributes,
  type BorderSides,
  type BoxRenderable,
  type DiffRenderable,
  type ScrollBoxRenderable,
} from "@opentui/core"
import { LANGUAGE_EXTENSIONS } from "../../util/filetype"
import { useBindings, useCommandShortcut } from "../../keymap"
import { useTheme } from "../../context/theme"
import { onLanguageChange, useI18n } from "../../i18n"
import i18next from "i18next"
import { useTerminalDimensions } from "@opentui/solid"
import path from "path"
import { createEffect, createMemo, createResource, createSignal, For, Match, onCleanup, Show, Switch } from "solid-js"
import { DiffViewerFileTree } from "./diff-viewer-file-tree"
import { Panel, PanelGroup, Separator } from "./diff-viewer-ui"
import { DialogSelect } from "../../ui/dialog-select"
import { getScrollAcceleration } from "../../util/scroll"
import {
  allExpandedFileTreeDirectories,
  buildFileTree,
  fileTreeFileSelection,
  type FileTreeRow,
  flattenFileTree,
  moveFileTreeSelection,
  moveFileTreeSelectionToFirstChild,
  moveFileTreeSelectionToParent,
  movePatchFileIndex,
  orderedPatchFileIndexes,
  setFileTreeDirectoryExpanded,
  showDiffViewerFileTree,
  singlePatchFileIndex,
  toggleFileTreeDirectory,
} from "./diff-viewer-file-tree-utils"

const ROUTE = "diff"
const MIN_SPLIT_WIDTH = 100
const FILE_TREE_WIDTH = 32
const PLAIN_TEXT_FILETYPE = "opencode-plain-text"
const WORKING_TREE_DIFF_CONTEXT_LINES = 12
const KV_SHOW_FILE_TREE = "diff_viewer_show_file_tree"
const KV_SINGLE_PATCH = "diff_viewer_single_patch"
const KV_VIEW = "diff_viewer_view"
type DiffMode = "git" | "last-turn"
type DiffViewerFocus = "patches" | "files"
type DiffView = "split" | "unified"
type SelectedHunk = { readonly fileIndex: number; readonly hunkIndex: number; readonly scrollTop: number }

type DiffFile = {
  readonly file: string
  readonly patch?: string
  readonly additions: number
  readonly deletions: number
  readonly status: "added" | "deleted" | "modified"
}

const normalizeDiffs = (diffs: readonly (VcsFileDiff | SnapshotFileDiff)[]): DiffFile[] =>
  diffs.flatMap((item) =>
    item.file
      ? [
          {
            file: item.file,
            patch: item.patch,
            additions: item.additions,
            deletions: item.deletions,
            status: item.status ?? "modified",
          } satisfies DiffFile,
        ]
      : [],
  )

function filetype(input?: string) {
  if (!input) return "none"
  const language = LANGUAGE_EXTENSIONS[path.extname(input)]
  if (["typescriptreact", "javascriptreact", "javascript"].includes(language)) return "typescript"
  return language
}

function storedView(value: unknown): DiffView | undefined {
  if (value === "split" || value === "unified") return value
}

function DiffViewer(props: { api: TuiPluginApi }) {
  const dimensions = useTerminalDimensions()
  const themeState = useTheme()
  const { t } = useI18n()
  const theme = () => props.api.theme.current
  const params = () =>
    ("params" in props.api.route.current ? props.api.route.current.params : undefined) as
      | {
          mode?: DiffMode
          sessionID?: string
          messageID?: string
          returnRoute?: TuiRouteCurrent
        }
      | undefined
  const mode = () => params()?.mode ?? "git"
  const diffInput = createMemo(() => {
    const sessionID = params()?.sessionID
    return {
      mode: mode(),
      sessionID,
      messageID: params()?.messageID,
      directory: sessionID ? props.api.state.session.get(sessionID)?.directory : undefined,
    }
  })
  const [diff] = createResource(diffInput, async (input) => {
    if (input.mode === "last-turn") {
      const sessionID = input.sessionID
      if (!sessionID) return []
      const result = await props.api.client.session.diff(
        { sessionID, messageID: input.messageID },
        { throwOnError: true },
      )
      return normalizeDiffs(result.data ?? [])
    }

    const result = await props.api.client.vcs.diff(
      { directory: input.directory, mode: "git", context: WORKING_TREE_DIFF_CONTEXT_LINES },
      { throwOnError: true },
    )
    return normalizeDiffs(result.data ?? [])
  })
  const files = createMemo(() => diff() ?? [])
  const [focus, setFocus] = createSignal<DiffViewerFocus>("patches")
  const [fileTreeEnabled, setFileTreeEnabled] = createSignal(
    props.api.kv.get<boolean>(KV_SHOW_FILE_TREE, true) !== false,
  )
  const showFileTree = createMemo(() => showDiffViewerFileTree(fileTreeEnabled(), files().length))
  const [singlePatch, setSinglePatch] = createSignal(props.api.kv.get<boolean>(KV_SINGLE_PATCH, false) === true)
  const patchPaneWidth = createMemo(() => dimensions().width - (showFileTree() ? 33 : 0) - 4)
  const patchLeftBorder = createMemo<BorderSides[]>(() => (showFileTree() ? ["left"] : []))
  const splitAvailable = createMemo(() => patchPaneWidth() >= MIN_SPLIT_WIDTH)
  const defaultView = createMemo(() => {
    if (props.api.tuiConfig.diff_style === "stacked") return "unified"
    return splitAvailable() ? "split" : "unified"
  })
  const [viewOverride, setViewOverride] = createSignal<DiffView | undefined>(storedView(props.api.kv.get(KV_VIEW)))
  const view = createMemo(() => (splitAvailable() ? (viewOverride() ?? defaultView()) : "unified"))
  const fileTree = createMemo(() => buildFileTree(files()))
  const [expandedFileNodes, setExpandedFileNodes] = createSignal<ReadonlySet<number>>(new Set())
  const [highlightedFileNode, setHighlightedFileNode] = createSignal<number | undefined>()
  const [lastHighlightedFileNode, setLastHighlightedFileNode] = createSignal<number | undefined>()
  const [activePatchFileIndex, setActivePatchFileIndex] = createSignal<number | undefined>()
  const [selectedFileIndex, setSelectedFileIndex] = createSignal<number | undefined>()
  const [reviewedFileNames, setReviewedFileNames] = createSignal<ReadonlySet<string>>(new Set())
  const patchScrollAcceleration = createMemo(() => getScrollAcceleration(props.api.tuiConfig))
  const fileRows = createMemo(() => flattenFileTree(fileTree(), expandedFileNodes()))
  const patchFileIndexes = createMemo(() => orderedPatchFileIndexes(flattenFileTree(fileTree())))
  const focusRunner = (input: Record<DiffViewerFocus, () => void>) => () => input[focus()]()
  const switchFocusShortcut = useCommandShortcut("diff.switch_focus")
  const nextHunkShortcut = useCommandShortcut("diff.next_hunk")
  const previousHunkShortcut = useCommandShortcut("diff.previous_hunk")
  const nextFileShortcut = useCommandShortcut("diff.next_file")
  const previousFileShortcut = useCommandShortcut("diff.previous_file")
  const toggleFileTreeShortcut = useCommandShortcut("diff.toggle_file_tree")
  const singlePatchShortcut = useCommandShortcut("diff.single_patch")
  const switchSourceShortcut = useCommandShortcut("diff.switch_source")
  const toggleViewShortcut = useCommandShortcut("diff.toggle_view")
  const markReviewedShortcut = useCommandShortcut("diff.mark_reviewed")
  const helpShortcut = useCommandShortcut("diff.help")
  let scroll: ScrollBoxRenderable | undefined
  const patchNodeByFileIndex = new Map<number, BoxRenderable>()
  const diffNodeByFileIndex = new Map<number, DiffRenderable>()
  const [selectedHunk, setSelectedHunk] = createSignal<SelectedHunk | undefined>()
  const [pendingPatchScrollFileIndex, setPendingPatchScrollFileIndex] = createSignal<number | undefined>()
  const [patchFillerHeight, setPatchFillerHeight] = createSignal(0)

  onCleanup(() => props.api.ui.dialog.clear())

  createEffect(() => {
    setExpandedFileNodes(allExpandedFileTreeDirectories(fileTree()))
    setHighlightedFileNode(undefined)
    setLastHighlightedFileNode(undefined)
    setActivePatchFileIndex(undefined)
    setSelectedFileIndex(undefined)
    setSelectedHunk(undefined)
    setReviewedFileNames(new Set<string>())
  })

  const ensureHighlightedFileNode = () => {
    const highlighted = highlightedFileNode()
    if (highlighted !== undefined && fileRows().some((row) => row.id === highlighted)) return
    const lastHighlighted = lastHighlightedFileNode()
    const next =
      lastHighlighted !== undefined && fileRows().some((row) => row.id === lastHighlighted)
        ? lastHighlighted
        : fileRows().find((row) => row.fileIndex !== undefined)?.id
    setHighlightedFileNode(next)
  }

  const setHighlighted = (node: number | undefined) => {
    setHighlightedFileNode(node)
    if (node !== undefined) setLastHighlightedFileNode(node)
  }

  const moveFileSelection = (offset: number) =>
    setHighlighted(moveFileTreeSelection(fileRows(), highlightedFileNode(), offset))

  const clearFileTreePatchState = () => {
    setHighlightedFileNode(undefined)
    setActivePatchFileIndex(undefined)
    setSelectedHunk(undefined)
  }

  const scrollPatchNodeToTop = (patchNode: BoxRenderable) => {
    requestAnimationFrame(() => {
      if (!scroll) return
      const scrollDelta = patchNode.y - scroll.viewport.y
      const contentY = scroll.scrollTop + scrollDelta
      const offset = contentY === 0 ? 0 : 1
      scroll.scrollBy(scrollDelta + offset)
    })
  }

  const revealFileTreeFile = (fileIndex: number) => {
    const selection = fileTreeFileSelection(fileTree(), fileIndex)
    if (!selection) return
    setExpandedFileNodes((expanded) => {
      const next = new Set(expanded)
      selection.expandedNodes.forEach((node) => next.add(node))
      return next
    })
    setHighlighted(selection.highlightedNode)
  }

  const selectPatchFile = (fileIndex: number) => {
    revealFileTreeFile(fileIndex)
    setActivePatchFileIndex(fileIndex)
    setSelectedFileIndex(fileIndex)
  }

  const scrollToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
    const patchNode = patchNodeByFileIndex.get(fileIndex)
    if (patchNode) scrollPatchNodeToTop(patchNode)
  }

  const jumpToFileIndex = (fileIndex: number | undefined) => {
    if (fileIndex === undefined) return
    setSelectedHunk(undefined)
    scrollToFileIndex(fileIndex)
  }

  const currentPatchFileIndex = () => {
    if (!scroll) return undefined
    const viewportContentY = scroll.scrollTop + 1
    const entries = patchFileIndexes()
      .map((fileIndex) => ({
        fileIndex,
        node: patchNodeByFileIndex.get(fileIndex),
      }))
      .filter((entry): entry is { fileIndex: number; node: BoxRenderable } => Boolean(entry.node))
      .map((entry) => ({
        ...entry,
        contentY: scroll!.scrollTop + entry.node.y - scroll!.viewport.y,
      }))
      .sort((left, right) => left.contentY - right.contentY)
    return entries.findLast((entry) => entry.contentY <= viewportContentY)?.fileIndex ?? entries[0]?.fileIndex
  }

  const jumpRelativePatchFile = (offset: number) => {
    setSelectedHunk(undefined)
    const next = movePatchFileIndex(patchFileIndexes(), selectedFileIndex() ?? activePatchFileIndex(), offset)
    if (singlePatch()) {
      if (next === undefined) return
      selectPatchFile(next)
      scrollSinglePatchToTop()
      return
    }
    scrollToFileIndex(next)
  }

  const jumpRelativeHunk = (offset: -1 | 1) => {
    const patchScroll = scroll
    if (!patchScroll) return
    const hunks = visiblePatchFiles()
      .flatMap((entry) => {
        const node = diffNodeByFileIndex.get(entry.fileIndex)
        if (!node || node.isDestroyed) return []
        const contentY = patchScroll.scrollTop + node.y - patchScroll.viewport.y
        return node.diff
          .split("\n")
          .flatMap((line, row) => (line.startsWith("@@") ? [row] : []))
          .map((row, hunkIndex) => ({
            fileIndex: entry.fileIndex,
            hunkIndex,
            contentY: contentY + row,
          }))
      })
      .sort((left, right) => left.contentY - right.contentY)
    const selected = selectedHunk()
    const selectedIndex =
      selected?.scrollTop === patchScroll.scrollTop
        ? hunks.findIndex((hunk) => hunk.fileIndex === selected.fileIndex && hunk.hunkIndex === selected.hunkIndex)
        : -1
    const next =
      selectedIndex !== -1
        ? hunks[selectedIndex + offset]
        : offset === 1
          ? hunks.find((hunk) => hunk.contentY > patchScroll.scrollTop)
          : hunks.findLast((hunk) => hunk.contentY < patchScroll.scrollTop)
    if (!next) return
    selectPatchFile(next.fileIndex)
    patchScroll.scrollTo(next.contentY)
    setSelectedHunk({ fileIndex: next.fileIndex, hunkIndex: next.hunkIndex, scrollTop: patchScroll.scrollTop })
  }

  const highlightedPatchFileIndex = () => fileRows().find((row) => row.id === highlightedFileNode())?.fileIndex
  const firstPatchFileIndex = () => fileRows().find((row) => row.fileIndex !== undefined)?.fileIndex
  const visiblePatchFiles = createMemo(() => {
    if (!singlePatch()) {
      return patchFileIndexes().flatMap((fileIndex) => {
        const file = files()[fileIndex]
        return file ? [{ file, fileIndex }] : []
      })
    }
    const fileIndex = singlePatchFileIndex(
      selectedFileIndex(),
      activePatchFileIndex(),
      currentPatchFileIndex(),
      firstPatchFileIndex(),
    )
    const file = fileIndex === undefined ? undefined : files()[fileIndex]
    return file && fileIndex !== undefined ? [{ file, fileIndex }] : []
  })

  const ensureHighlightedPatchFile = () => {
    const fileIndex = currentPatchFileIndex() ?? activePatchFileIndex() ?? firstPatchFileIndex()
    if (fileIndex === undefined) return
    selectPatchFile(fileIndex)
  }

  const scrollToPatchFileIndexAfterRender = (fileIndex: number) => {
    setPendingPatchScrollFileIndex(fileIndex)
    requestAnimationFrame(() => {
      const patchNode = patchNodeByFileIndex.get(fileIndex)
      if (patchNode) scrollPatchNodeToTop(patchNode)
      requestAnimationFrame(() => {
        const patchNode = patchNodeByFileIndex.get(fileIndex)
        if (patchNode) scrollPatchNodeToTop(patchNode)
        setPendingPatchScrollFileIndex(undefined)
      })
    })
  }

  const scrollSinglePatchToTop = () => {
    requestAnimationFrame(() => {
      scroll?.scrollTo(0)
      requestAnimationFrame(() => scroll?.scrollTo(0))
    })
  }

  const measurePatchFiller = () => {
    requestAnimationFrame(() => {
      if (!scroll) return
      const entries = visiblePatchFiles()
        .map((entry) => patchNodeByFileIndex.get(entry.fileIndex))
        .filter((node): node is BoxRenderable => Boolean(node))
      if (entries.length === 0) {
        setPatchFillerHeight(0)
        return
      }
      const contentHeight = Math.max(
        ...entries.map((node) => scroll!.scrollTop + node.y - scroll!.viewport.y + node.height),
      )
      setPatchFillerHeight(Math.max(0, scroll.viewport.height - contentHeight))
    })
  }

  const registerPatchNode = (fileIndex: number, element: BoxRenderable) => {
    patchNodeByFileIndex.set(fileIndex, element)
    measurePatchFiller()
    if (pendingPatchScrollFileIndex() !== fileIndex) return
    requestAnimationFrame(() => {
      scrollPatchNodeToTop(element)
      requestAnimationFrame(() => {
        scrollPatchNodeToTop(element)
        setPendingPatchScrollFileIndex(undefined)
      })
    })
  }

  createEffect(() => {
    visiblePatchFiles()
    dimensions()
    view()
    measurePatchFiller()
  })

  const toggleSelectedFileTreeRow = () => {
    const highlighted = fileRows().find((row) => row.id === highlightedFileNode())
    if (highlighted?.fileIndex !== undefined) {
      jumpToFileIndex(highlighted.fileIndex)
      return
    }
    setExpandedFileNodes((expanded) => toggleFileTreeDirectory(fileTree(), expanded, highlightedFileNode()))
  }

  const clickFileTreeRow = (row: FileTreeRow) => {
    setFocus("files")
    setHighlighted(row.id)
    if (row.fileIndex !== undefined) {
      jumpToFileIndex(row.fileIndex)
      return
    }
    setExpandedFileNodes((expanded) => toggleFileTreeDirectory(fileTree(), expanded, row.id))
  }

  const toggleSelectedFileReviewed = () => {
    const fileIndex =
      focus() === "files"
        ? fileRows().find((row) => row.id === highlightedFileNode())?.fileIndex
        : (selectedFileIndex() ?? activePatchFileIndex() ?? currentPatchFileIndex())
    const file = fileIndex === undefined ? undefined : files()[fileIndex]?.file
    if (!file) return
    setReviewedFileNames((reviewed) => {
      const next = new Set(reviewed)
      if (next.has(file)) next.delete(file)
      else next.add(file)
      return next
    })
  }

  const commands = [
    {
      name: "diff.close",
      title: t("command.diff_close"),
      category: t("category.vcs"),
      run() {
        const returnRoute = params()?.returnRoute
        props.api.ui.dialog.clear()

        props.api.route.navigate(
          returnRoute?.name ?? "home",
          returnRoute && "params" in returnRoute ? returnRoute.params : undefined,
        )
      },
    },
    {
      name: "diff.down",
      title: t("command.diff_move_down"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          moveFileSelection(1)
        },
        patches() {
          clearFileTreePatchState()
          scroll?.scrollBy(1)
        },
      }),
    },
    {
      name: "diff.up",
      title: t("command.diff_move_up"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          moveFileSelection(-1)
        },
        patches() {
          clearFileTreePatchState()
          scroll?.scrollBy(-1)
        },
      }),
    },
    {
      name: "diff.page.down",
      title: t("command.diff_page_down"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          moveFileSelection(8)
        },
        patches() {
          clearFileTreePatchState()
          if (scroll) scroll.scrollBy(scroll.height)
        },
      }),
    },
    {
      name: "diff.page.up",
      title: t("command.diff_page_up"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          moveFileSelection(-8)
        },
        patches() {
          clearFileTreePatchState()
          if (scroll) scroll.scrollBy(-scroll.height)
        },
      }),
    },
    {
      name: "diff.toggle",
      title: t("command.diff_toggle"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          toggleSelectedFileTreeRow()
        },
        patches() {},
      }),
    },
    {
      name: "diff.expand",
      title: t("command.diff_expand"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          const highlighted = highlightedFileNode()
          if (highlighted !== undefined && expandedFileNodes().has(highlighted)) {
            setHighlighted(moveFileTreeSelectionToFirstChild(fileRows(), highlighted))
            return
          }
          setExpandedFileNodes((expanded) =>
            setFileTreeDirectoryExpanded(fileTree(), expanded, highlightedFileNode(), true),
          )
        },
        patches() {},
      }),
    },
    {
      name: "diff.expand_all",
      title: t("command.diff_expand_all"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          setExpandedFileNodes(allExpandedFileTreeDirectories(fileTree()))
        },
        patches() {},
      }),
    },
    {
      name: "diff.collapse",
      title: t("command.diff_collapse"),
      category: t("category.vcs"),
      run: focusRunner({
        files() {
          const highlighted = highlightedFileNode()
          const node = highlighted === undefined ? undefined : fileTree().nodes[highlighted]
          if (node?.kind !== "directory" || !expandedFileNodes().has(node.id)) {
            setHighlighted(moveFileTreeSelectionToParent(fileRows(), highlighted))
            return
          }
          setExpandedFileNodes((expanded) =>
            setFileTreeDirectoryExpanded(fileTree(), expanded, highlightedFileNode(), false),
          )
        },
        patches() {},
      }),
    },
    {
      name: "diff.next_hunk",
      title: t("command.diff_next_hunk"),
      category: t("category.vcs"),
      run() {
        jumpRelativeHunk(1)
      },
    },
    {
      name: "diff.previous_hunk",
      title: t("command.diff_previous_hunk"),
      category: t("category.vcs"),
      run() {
        jumpRelativeHunk(-1)
      },
    },
    {
      name: "diff.next_file",
      title: t("command.diff_next_file"),
      category: t("category.vcs"),
      run() {
        jumpRelativePatchFile(1)
      },
    },
    {
      name: "diff.previous_file",
      title: t("command.diff_previous_file"),
      category: t("category.vcs"),
      run() {
        jumpRelativePatchFile(-1)
      },
    },
    {
      name: "diff.mark_reviewed",
      title: t("command.diff_mark_reviewed"),
      category: t("category.vcs"),
      run() {
        toggleSelectedFileReviewed()
      },
    },
    {
      name: "diff.switch_focus",
      title: t("command.diff_switch_focus"),
      category: t("category.vcs"),
      run() {
        if (!showFileTree()) return
        setFocus((current) => {
          if (current === "files") return "patches"
          ensureHighlightedFileNode()
          return "files"
        })
      },
    },
    {
      name: "diff.toggle_file_tree",
      title: t("command.diff_toggle_file_tree"),
      category: t("category.vcs"),
      run() {
        const next = !fileTreeEnabled()
        if (!next) setFocus("patches")
        setFileTreeEnabled(next)
        props.api.kv.set(KV_SHOW_FILE_TREE, next)
      },
    },
    {
      name: "diff.single_patch",
      title: t("command.diff_single_patch"),
      category: t("category.vcs"),
      run() {
        setSelectedHunk(undefined)
        if (!singlePatch()) {
          ensureHighlightedPatchFile()
          setSinglePatch(true)
          props.api.kv.set(KV_SINGLE_PATCH, true)
          scrollSinglePatchToTop()
          return
        }
        const fileIndex =
          visiblePatchFiles()[0]?.fileIndex ??
          singlePatchFileIndex(
            selectedFileIndex(),
            activePatchFileIndex(),
            currentPatchFileIndex(),
            firstPatchFileIndex(),
          )
        if (fileIndex !== undefined) selectPatchFile(fileIndex)
        setSinglePatch(false)
        props.api.kv.set(KV_SINGLE_PATCH, false)
        if (fileIndex !== undefined) scrollToPatchFileIndexAfterRender(fileIndex)
      },
    },
    {
      name: "diff.switch_source",
      title: t("command.diff_switch_source"),
      category: t("category.vcs"),
      run() {
        openSwitchDiffDialog()
      },
    },
    {
      name: "diff.toggle_view",
      title: t("command.diff_toggle_view"),
      category: t("category.vcs"),
      run() {
        if (!splitAvailable()) return
        setSelectedHunk(undefined)
        const next = view() === "split" ? "unified" : "split"
        setViewOverride(next)
        props.api.kv.set(KV_VIEW, next)
      },
    },
    {
      name: "diff.help",
      title: t("command.diff_help"),
      category: t("category.vcs"),
      run() {
        openHelpDialog()
      },
    },
  ]

  const switchDiffOptions = createMemo(() => [
    {
      title: t("command.diff_working_tree"),
      value: "git" as const,
      description: t("dialog.desc_diff_working_tree"),
    },
    {
      title: t("command.diff_last_turn"),
      value: "last-turn" as const,
      description: t("dialog.desc_diff_last_turn"),
    },
  ])

  const openSwitchDiffDialog = () => {
    props.api.ui.dialog.replace(() => (
      <DialogSelect
        title={t("command.diff_switch_source")}
        skipFilter={true}
        renderFilter={false}
        current={mode()}
        options={switchDiffOptions().map((option) => ({
          ...option,
          onSelect(dialog) {
            dialog.clear()
            props.api.route.navigate(ROUTE, {
              mode: option.value,
              sessionID: params()?.sessionID,
              messageID: params()?.messageID,
              returnRoute: params()?.returnRoute,
            })
          },
        }))}
      />
    ))
  }

  const openHelpDialog = () => {
    props.api.ui.dialog.replace(() => <DiffViewerHelpDialog />)
    props.api.ui.dialog.setSize("large")
  }

  useBindings(() => ({
    commands,
    bindings: [
      { key: "j,down", cmd: "diff.down", desc: t("dialog.desc_diff_move_down") },
      { key: "k,up", cmd: "diff.up", desc: t("dialog.desc_diff_move_up") },
      { key: "pagedown,ctrl+f", cmd: "diff.page.down", desc: t("dialog.desc_diff_page_down") },
      { key: "pageup,ctrl+b", cmd: "diff.page.up", desc: t("dialog.desc_diff_page_up") },
      { key: "m", cmd: "diff.mark_reviewed", desc: t("dialog.desc_diff_mark_reviewed") },
      ...props.api.tuiConfig.keybinds.gather(
        "diff",
        commands.map((command) => command.name),
      ),
    ],
  }))

  return (
    <box position="absolute" zIndex={2500} left={0} top={0} width={dimensions().width} height={dimensions().height}>
      <PanelGroup axis="y" width="100%" height="100%">
        <Panel border="none" flexShrink={0} padding={0} paddingLeft={1}>
          <text fg={theme().text}>Diff </text>
          <text fg={theme().textMuted}>{mode() === "last-turn" ? t("dialog.diff_mode_last_turn") : t("dialog.diff_mode_working_tree")}</text>
          <box flexGrow={1} />
          <text fg={theme().textMuted}>
            {files().length === 1 ? t("dialog.diff_file_count", { count: files().length }) : t("dialog.diff_file_count_plural", { count: files().length })}
          </text>
        </Panel>

        <box flexGrow={1} minHeight={0}>
          <Switch>
            <Match when={diff.loading}>
              <Separator axis="x" />
              <box flexGrow={1} paddingLeft={1}>
                <text fg={theme().textMuted}>{t("dialog.loading_diff")}</text>
              </box>
            </Match>
            <Match when={!diff.loading && files().length === 0}>
              <Separator axis="x" />
              <box flexGrow={1} paddingLeft={1}>
                <text fg={theme().textMuted}>{t("dialog.no_diff")}</text>
              </box>
            </Match>
            <Match when={!diff.loading && diff.error}>
              <Separator axis="x" />
              <box flexGrow={1} paddingLeft={1}>
                <text fg={theme().error}>{t("dialog.failed_load_diff")}</text>
              </box>
            </Match>
            <Match when={!diff.loading}>
              <PanelGroup axis="x">
                <Show when={showFileTree()}>
                  <DiffViewerFileTree
                    files={files()}
                    loading={diff.loading}
                    error={diff.error}
                    theme={theme()}
                    focused={focus() === "files"}
                    width={FILE_TREE_WIDTH}
                    highlightedNode={highlightedFileNode()}
                    selectedFileIndex={selectedFileIndex()}
                    reviewedFileNames={reviewedFileNames()}
                    expandedNodes={expandedFileNodes()}
                    onRowClick={clickFileTreeRow}
                  />
                </Show>

                <Panel flexGrow={1} minHeight={0} border="none">
                  <Separator axis="x" start={showFileTree() ? "edge-out" : undefined} />
                  <scrollbox
                    ref={(element: ScrollBoxRenderable) => (scroll = element)}
                    flexGrow={1}
                    minHeight={0}
                    scrollAcceleration={patchScrollAcceleration()}
                    verticalScrollbarOptions={{ visible: false }}
                    horizontalScrollbarOptions={{ visible: false }}
                  >
                    <For each={visiblePatchFiles()}>
                      {(entry, index) => {
                        const reviewed = () => reviewedFileNames().has(entry.file.file)
                        return (
                          <box ref={(element: BoxRenderable) => registerPatchNode(entry.fileIndex, element)}>
                            {index() !== 0 ? <Separator axis="x" start={showFileTree() ? "edge" : undefined} /> : null}
                            <box
                              flexDirection="row"
                              gap={1}
                              flexShrink={0}
                              paddingLeft={1}
                              paddingRight={1}
                              border={patchLeftBorder()}
                              borderColor={theme().border}
                            >
                              <text fg={reviewed() ? theme().textMuted : theme().text}>{entry.file.file}</text>
                              <box flexGrow={1} />
                              <text fg={reviewed() ? theme().textMuted : theme().diffAdded}>
                                +{entry.file.additions}
                              </text>
                              <text fg={reviewed() ? theme().textMuted : theme().diffRemoved}>
                                -{entry.file.deletions}
                              </text>
                            </box>
                            <Separator axis="x" start={showFileTree() ? "edge" : undefined} />
                            <Show
                              when={entry.file.patch}
                              fallback={<text fg={theme().textMuted}>{t("dialog.no_patch_available")}</text>}
                            >
                              {(patch) => (
                                <box border={patchLeftBorder()} borderColor={theme().border}>
                                  <diff
                                    ref={(element: DiffRenderable) => diffNodeByFileIndex.set(entry.fileIndex, element)}
                                    diff={patch()}
                                    view={view()}
                                    filetype={reviewed() ? PLAIN_TEXT_FILETYPE : filetype(entry.file.file)}
                                    syntaxStyle={themeState.syntax()}
                                    showLineNumbers={true}
                                    width="100%"
                                    wrapMode="char"
                                    fg={reviewed() ? theme().textMuted : theme().text}
                                    addedBg={reviewed() ? theme().backgroundElement : theme().diffAddedBg}
                                    removedBg={reviewed() ? theme().backgroundElement : theme().diffRemovedBg}
                                    addedSignColor={reviewed() ? theme().textMuted : theme().diffHighlightAdded}
                                    removedSignColor={reviewed() ? theme().textMuted : theme().diffHighlightRemoved}
                                    lineNumberFg={theme().diffLineNumber}
                                    addedLineNumberBg={
                                      reviewed() ? theme().backgroundElement : theme().diffAddedLineNumberBg
                                    }
                                    removedLineNumberBg={
                                      reviewed() ? theme().backgroundElement : theme().diffRemovedLineNumberBg
                                    }
                                  />
                                </box>
                              )}
                            </Show>
                          </box>
                        )
                      }}
                    </For>
                    <Show when={patchFillerHeight() > 0}>
                      <box height={patchFillerHeight()} border={patchLeftBorder()} borderColor={theme().border} />
                    </Show>
                  </scrollbox>
                  <Separator axis="x" start={showFileTree() ? "edge-in" : undefined} />
                </Panel>
              </PanelGroup>
            </Match>
          </Switch>
        </box>

        <Panel flexShrink={0} gap={2} paddingLeft={1} border="none">
          <Show when={switchFocusShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_focus_file_tree")}</span>
              </text>
            )}
          </Show>
          <Show when={nextFileShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_next_file")}</span>
              </text>
            )}
          </Show>
          <Show when={nextHunkShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_next_hunk")}</span>
              </text>
            )}
          </Show>
          <Show when={previousHunkShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_previous_hunk")}</span>
              </text>
            )}
          </Show>
          <Show when={previousFileShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_previous_file")}</span>
              </text>
            )}
          </Show>
          <Show when={switchSourceShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_switch_source")}</span>
              </text>
            )}
          </Show>
          <Show when={markReviewedShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_mark_reviewed")}</span>
              </text>
            )}
          </Show>
          <Show when={helpShortcut()}>
            {(shortcut) => (
              <text fg={theme().text}>
                {shortcut()} <span style={{ fg: theme().textMuted }}>{t("dialog.diff_footer_all")}</span>
              </text>
            )}
          </Show>
        </Panel>
      </PanelGroup>
    </box>
  )
}

function DiffViewerHelpDialog() {
  const { t } = useI18n()
  const { theme } = useTheme()
  const rows = [
    {
      shortcut: () => "q",
      action: t("dialog.diff_help_close_viewer_action"),
      description: t("dialog.diff_help_close_viewer_description"),
    },
    {
      shortcut: useCommandShortcut("diff.switch_focus"),
      action: t("dialog.diff_help_focus_file_tree_action"),
      description: t("dialog.diff_help_focus_file_tree_description"),
    },
    {
      shortcut: useCommandShortcut("diff.next_hunk"),
      action: t("dialog.diff_help_next_hunk_action"),
      description: t("dialog.diff_help_next_hunk_description"),
    },
    {
      shortcut: useCommandShortcut("diff.previous_hunk"),
      action: t("dialog.diff_help_previous_hunk_action"),
      description: t("dialog.diff_help_previous_hunk_description"),
    },
    {
      shortcut: useCommandShortcut("diff.next_file"),
      action: t("dialog.diff_help_next_file_action"),
      description: t("dialog.diff_help_next_file_description"),
    },
    {
      shortcut: useCommandShortcut("diff.previous_file"),
      action: t("dialog.diff_help_previous_file_action"),
      description: t("dialog.diff_help_previous_file_description"),
    },
    {
      shortcut: useCommandShortcut("diff.toggle_file_tree"),
      action: t("dialog.diff_help_toggle_file_tree_action"),
      description: t("dialog.diff_help_toggle_file_tree_description"),
    },
    {
      shortcut: useCommandShortcut("diff.single_patch"),
      action: t("dialog.diff_help_toggle_patches_action"),
      description: t("dialog.diff_help_toggle_patches_description"),
    },
    {
      shortcut: useCommandShortcut("diff.switch_source"),
      action: t("dialog.diff_help_switch_source_action"),
      description: t("dialog.diff_help_switch_source_description"),
    },
    {
      shortcut: useCommandShortcut("diff.toggle_view"),
      action: t("dialog.diff_help_toggle_view_action"),
      description: t("dialog.diff_help_toggle_view_description"),
    },
    {
      shortcut: useCommandShortcut("diff.expand_all"),
      action: t("dialog.diff_help_expand_all_action"),
      description: t("dialog.diff_help_expand_all_description"),
    },
    {
      shortcut: useCommandShortcut("diff.mark_reviewed"),
      action: t("dialog.diff_help_mark_reviewed_action"),
      description: t("dialog.diff_help_mark_reviewed_description"),
    },
  ]

  return (
    <box paddingLeft={2} paddingRight={2} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={TextAttributes.BOLD} fg={theme.text}>
          {t("dialog.diff_help_title")}
        </text>
        <text fg={theme.textMuted}>{t("dialog.esc")}</text>
      </box>
      <box flexDirection="row">
        <text fg={theme.textMuted} width={5} wrapMode="none">
          {t("dialog.diff_help_col_key")}
        </text>
        <text fg={theme.textMuted} width={22} wrapMode="none">
          {t("dialog.diff_help_col_action")}
        </text>
        <text fg={theme.textMuted}>{t("dialog.diff_help_col_description")}</text>
      </box>
      <For each={rows}>
        {(row) => (
          <box flexDirection="row">
            <text fg={theme.text} width={5} wrapMode="none">
              {row.shortcut() || "-"}
            </text>
            <text fg={theme.text} width={22} wrapMode="none">
              {row.action}
            </text>
            <text fg={theme.textMuted}>{row.description}</text>
          </box>
        )}
      </For>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.route.register([
    {
      name: ROUTE,
      render: () => <DiffViewer api={api} />,
    },
  ])

  const registerKeymap = () =>
    api.keymap.registerLayer({
      commands: [
        {
          name: "diff.open",
          title: i18next.t("command.diff_open"),
          slashName: "diff",
          category: i18next.t("category.vcs"),
          namespace: "palette",
          run() {
            api.route.navigate(ROUTE, {
              mode: "git",
              sessionID: "params" in api.route.current ? api.route.current.params?.sessionID : undefined,
              returnRoute: api.route.current,
            })
            api.ui.dialog.clear()
          },
        },
      ],
    })

  let unregisterLayer = registerKeymap()
  onLanguageChange(() => {
    unregisterLayer()
    unregisterLayer = registerKeymap()
  })
}

export default {
  id: "diff-viewer",
  tui,
}
