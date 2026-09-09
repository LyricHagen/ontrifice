export function ThemeScript() {
  const script = `
    (function() {
      var theme = localStorage.getItem('theme') || 'dark';
      document.documentElement.setAttribute('data-theme', theme);
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
