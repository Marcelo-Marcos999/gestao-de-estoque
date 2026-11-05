/**
 * Guarda arquivos (fotos) no IndexedDB, para sobreviver ao recarregamento da página.
 *
 * Por que existe: ao abrir a câmera, o Android pode descartar a página para liberar
 * memória e recarregá-la na volta. O que estava só na memória (inclusive a foto que
 * acabou de ser tirada) some. O `localStorage` não serve: guarda texto e tem teto de
 * poucos MB. Aqui entram só os arquivos de um rascunho, e tudo falha em silêncio:
 * guardar é conveniência, nunca pode derrubar a tela.
 */

const DB_NAME = 'gv-arquivos'
const STORE = 'rascunho'

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => request.result.createObjectStore(STORE)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch {
      // Navegador sem IndexedDB ou com dados de site bloqueados.
      resolve(null)
    }
  })
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await open()
  if (!db) return null

  return new Promise<T | null>((resolve) => {
    try {
      const request = action(db.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  }).finally(() => db.close())
}

export async function saveBlob(key: string, file: Blob): Promise<void> {
  await run('readwrite', (store) => store.put(file, key))
}

export async function loadBlob(key: string): Promise<Blob | null> {
  const found = await run<unknown>('readonly', (store) => store.get(key))
  return found instanceof Blob ? found : null
}

export async function deleteBlob(key: string): Promise<void> {
  await run('readwrite', (store) => store.delete(key))
}
