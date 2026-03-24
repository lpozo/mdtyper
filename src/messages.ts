// Messages sent FROM extension host TO webview
export type WebviewMessage = { type: 'update'; content: string };

// Messages sent FROM webview TO extension host
export type ExtensionMessage =
  | { type: 'ready' }
  | { type: 'edit'; content: string }
  | { type: 'link'; href: string };

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const type = (value as Record<string, unknown>)['type'];
  if (type === 'ready') {
    return true;
  }
  if (type === 'edit') {
    return typeof (value as Record<string, unknown>)['content'] === 'string';
  }
  if (type === 'link') {
    return typeof (value as Record<string, unknown>)['href'] === 'string';
  }
  return false;
}
