export async function promoteAtomically<T>(createTemporaryArtifact: () => Promise<T>, swapReaderPointer: (artifact: T) => Promise<void>): Promise<T> {
  const artifact = await createTemporaryArtifact();
  await swapReaderPointer(artifact);
  return artifact;
}
