/**
 * Neo4j driver — server-only.
 *
 * Lazy singleton so the connection is only opened when a server fn that
 * actually needs it runs. Reads creds from env at call time (never at
 * module scope), per server-function-authoring guidance.
 */
import neo4j, { type Driver, type Session } from "neo4j-driver";

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (_driver) return _driver;
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const password = process.env.NEO4J_PASSWORD;
  if (!uri || !user || !password) {
    throw new Error(
      "Neo4j is not configured. Missing NEO4J_URI, NEO4J_USER, or NEO4J_PASSWORD.",
    );
  }
  _driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
    maxConnectionPoolSize: 10,
    connectionAcquisitionTimeout: 10_000,
    disableLosslessIntegers: true,
  });
  return _driver;
}

export async function withSession<T>(fn: (session: Session) => Promise<T>): Promise<T> {
  const session = getDriver().session();
  try {
    return await fn(session);
  } finally {
    await session.close();
  }
}

export async function closeDriver() {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
