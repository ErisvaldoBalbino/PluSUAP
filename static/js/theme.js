const savedTheme = localStorage.getItem('theme') || 'plus';
document.documentElement.setAttribute('data-theme', savedTheme);

window.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = document.documentElement.getAttribute('data-theme') === 'plus-dark';

        themeToggle.addEventListener('change', (e) => {
            const newTheme = e.target.checked ? 'plus-dark' : 'plus';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
        });
    }
});
