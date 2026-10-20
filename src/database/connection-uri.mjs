// Accept a complete MongoDB URI or the legacy Atlas hostname and separate credentials.
export function getConnectionUri(env = process.env) {
  const uri = env.MONGO_URI?.trim();
  if (!uri) {
    throw new Error('MONGO_URI is required');
  }
  if (/^mongodb(?:\+srv)?:\/\//.test(uri)) {
    return uri;
  }
  return `mongodb+srv://${encodeURIComponent(env.MONGO_USER || '')}:${encodeURIComponent(env.MONGO_PASSWORD || '')}@${uri}`;
}
