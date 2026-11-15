export function readFileBase64(file: File) {
  const reader = new FileReader();
  return new Promise<string>((resolve,reject) => {
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
