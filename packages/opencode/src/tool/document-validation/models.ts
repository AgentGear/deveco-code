export interface Section {
  level: number
  title: string
  normalizedTitle: string
  content: string
  children: Section[]
  lineNumber: number
}
