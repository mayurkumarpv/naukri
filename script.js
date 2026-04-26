copy(JSON.stringify(document.cookie.split('; ').map(c => {
  const [name, ...v] = c.split('=');
  return { name, value: v.join('='), domain: '.naukri.com', path: '/' };
})));
