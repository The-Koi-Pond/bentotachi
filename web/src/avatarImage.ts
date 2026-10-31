// Turns a chosen photo into a profile picture: the middle square of it,
// shrunk to `size` pixels, as a JPEG. Done on the phone, so a full-size
// camera photo (several MB) becomes a small file before it's uploaded.
export async function squarePicture(file: File, size = 400): Promise<File> {
  // Browsers turn the photo the right way up here (it may be stored sideways).
  const image = await createImageBitmap(file).catch(() => {
    throw new Error("That file couldn't be read as a picture. Try a JPEG or PNG photo.");
  });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.min(size, side);
  const context = canvas.getContext("2d")!;
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    canvas.width,
    canvas.height
  );
  image.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  if (!blob) throw new Error("Couldn't make the picture. Try another photo.");
  return new File([blob], "avatar.jpg", { type: "image/jpeg" });
}
