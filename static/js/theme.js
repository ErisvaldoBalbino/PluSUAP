const savedTheme = localStorage.getItem('theme') || 'suap';
document.documentElement.setAttribute('data-theme', savedTheme);

window.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'suap-dark';
        
        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'suap-dark' : 'suap';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
});
