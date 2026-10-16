(() => {
    let tema = 'dark';
    try { if (sessionStorage.getItem('theme') === 'light') tema = 'light'; } catch (_) {}
    document.documentElement.setAttribute('data-theme', tema);
    document.documentElement.style.colorScheme = tema;
})();
