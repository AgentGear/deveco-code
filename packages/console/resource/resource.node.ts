import type { KVNamespaceListOptions, KVNamespaceListResult, KVNamespacePutOptions } from "@cloudflare/workers-types"
import { Resource as ResourceBase } from "sst"
import Cloudflare from "cloudflare"

type KVNamespaceBulkGetResult = {
  values?: Record<string, string | number | boolean | object | null> | null
} | null

type KVNamespaceKeysListResult = {
  result: KVNamespaceListResult<unknown, string>["keys"]
}

export const waitUntil = async (promise: Promise<any>) => {
  await promise
}

export const Resource = new Proxy(
  {},
  {
    get(_target, prop: keyof typeof ResourceBase) {
      const value = ResourceBase[prop]
      if ("type" in value) {
        // @ts-ignore
        if (value.type === "sst.cloudflare.Bucket") {
          return {
            put: async () => {},
          }
        }
        // @ts-ignore
        if (value.type === "sst.cloudflare.Kv") {
          const client = new Cloudflare({
            apiToken: ResourceBase.CLOUDFLARE_API_TOKEN.value,
          })
          // @ts-ignore
          const namespaceId = value.namespaceId
          const accountId = ResourceBase.CLOUDFLARE_DEFAULT_ACCOUNT_ID.value
          return {
            get: (k: string | string[]) => {
              const isMulti = Array.isArray(k)
              const keys = isMulti ? k : [k]
              return client.kv.namespaces
                .bulkGet(namespaceId, {
                  keys,
                  account_id: accountId,
                })
                .then((result: KVNamespaceBulkGetResult) =>
                  isMulti ? new Map(Object.entries(result?.values ?? {})) : result?.values?.[k],
                )
            },
            put: (k: string, v: string, opts?: KVNamespacePutOptions) =>
              client.kv.namespaces.values.update(namespaceId, k, {
                account_id: accountId,
                value: v,
                expiration: opts?.expiration,
                expiration_ttl: opts?.expirationTtl,
                metadata: opts?.metadata,
              }),
            delete: (k: string) =>
              client.kv.namespaces.values.delete(namespaceId, k, {
                account_id: accountId,
              }),
            list: (opts?: KVNamespaceListOptions): Promise<KVNamespaceListResult<unknown, string>> =>
              client.kv.namespaces.keys
                .list(namespaceId, {
                  account_id: accountId,
                  prefix: opts?.prefix ?? undefined,
                })
                .then((result: KVNamespaceKeysListResult) => {
                  return {
                    keys: result.result,
                    list_complete: true,
                    cacheStatus: null,
                  }
                }),
          }
        }
      }
      return value
    },
  },
) as Record<string, any>
