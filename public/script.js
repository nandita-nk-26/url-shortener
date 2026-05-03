// Shared JavaScript for all pages
console.log('ShortLink Pro - Welcome!');

// Mobile menu toggle (if needed)
document.addEventListener('DOMContentLoaded', function() {
    const navToggle = document.querySelector('.nav-toggle');
    if (navToggle) {
        navToggle.addEventListener('click', function() {
            document.querySelector('.nav-menu').classList.toggle('active');
        });
    }
});