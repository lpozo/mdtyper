import { postLink } from './vscode-bridge';

// Default navigation is blocked in webviews — intercept clicks and forward
// hrefs to the extension host to open them.
export function initLinkInterceptor(): void {
  document.addEventListener('click', (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) {
      return;
    }
    const href = anchor.getAttribute('href');
    if (!href) {
      return;
    }
    e.preventDefault();
    postLink(href);
  });
}
