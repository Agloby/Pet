import { PostgresAccountStore } from "./postgres-store.mjs";
import { JsonAccountStore } from "./store.mjs";

export async function createAccountStore({ databaseUrl, dataFile, tokenSecret }) {
  if (!databaseUrl) return new JsonAccountStore(dataFile, { tokenSecret });

  const store = new PostgresAccountStore({
    connectionString: databaseUrl,
    tokenSecret,
  });
  await store.initialize();
  return store;
}
