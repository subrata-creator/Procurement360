/**
 * Looks up an image for a person or supplier by NAME.
 * Drop files into  src/assets/avatars/  named after the person/supplier:
 *   logitech.png   classmate.png   itc.png   dell.png (or dell-inc.png)   ashish-bhatia.png
 * If no file exists, callers fall back to initials - nothing breaks.
 */
const modules = import.meta.glob("../assets/avatars/*.{png,jpg,jpeg,webp,svg}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const byName: Record<string, string> = {};
Object.entries(modules).forEach(([path, url]) => {
  const file = (path.split("/").pop() ?? "").replace(/\.[^.]+$/, "");
  byName[slug(file)] = url;
});

export function getAvatarUrl(name: string): string | undefined {
  const key = slug(name);
  if (byName[key]) return byName[key];
  // lets "dell.png" match "Dell Inc." and so on
  const match = Object.keys(byName).find((file) => key.startsWith(file) || file.startsWith(key));
  return match ? byName[match] : undefined;
}