// Sistema de animaciones para el sitio
(function() {
    'use strict';

    // Configuración
    const config = {
        observerOptions: {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        }
    };

    // Inicializar cuando el DOM esté listo
    function init() {
        setupScrollAnimations();
        setupCardHoverEffects();
        setupParallaxEffect();
        setupGlowEffect();
        addAnimationClasses();
    }

    // Agregar clases de animación a elementos
    function addAnimationClasses() {
        // Animar cards con fade-in-up
        const cards = document.querySelectorAll('.card, .tutorial-card, .tip-card, .protocol-step');
        cards.forEach((card, index) => {
            card.classList.add('animate-on-scroll');
            card.style.animationDelay = `${index * 0.1}s`;
        });

        // Animar listas
        const lists = document.querySelectorAll('ul li');
        lists.forEach((li, index) => {
            li.classList.add('animate-list-item');
            li.style.animationDelay = `${index * 0.05}s`;
        });

        // Animar títulos
        const headings = document.querySelectorAll('h2, h3');
        headings.forEach((heading, index) => {
            heading.classList.add('animate-heading');
            heading.style.animationDelay = `${index * 0.1}s`;
        });
    }

    // Configurar animaciones al hacer scroll
    function setupScrollAnimations() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, config.observerOptions);

        // Observar elementos con animación
        const animatedElements = document.querySelectorAll('.animate-on-scroll, .animate-list-item, .animate-heading');
        animatedElements.forEach(el => observer.observe(el));
    }

    // Efectos hover mejorados para cards
    function setupCardHoverEffects() {
        const cards = document.querySelectorAll('.card, .tutorial-card, .tip-card, .protocol-step');
        
        cards.forEach(card => {
            card.addEventListener('mouseenter', function(e) {
                createRipple(e, this);
            });

            card.addEventListener('mousemove', function(e) {
                const rect = this.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                
                const rotateX = (y - centerY) / 20;
                const rotateY = (centerX - x) / 20;
                
                this.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-5px)`;
            });

            card.addEventListener('mouseleave', function() {
                this.style.transform = '';
            });
        });
    }

    // Crear efecto ripple
    function createRipple(event, element) {
        const ripple = document.createElement('span');
        ripple.classList.add('ripple-effect');
        
        const rect = element.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        const x = event.clientX - rect.left - size / 2;
        const y = event.clientY - rect.top - size / 2;
        
        ripple.style.width = ripple.style.height = `${size}px`;
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        
        element.style.position = 'relative';
        element.style.overflow = 'hidden';
        element.appendChild(ripple);
        
        setTimeout(() => ripple.remove(), 600);
    }

    // Efecto parallax sutil en el header
    function setupParallaxEffect() {
        const header = document.querySelector('header:not(.compact-header)');
        if (!header) return;

        window.addEventListener('scroll', () => {
            const scrolled = window.pageYOffset;
            const rate = scrolled * 0.5;
            header.style.transform = `translate3d(0, ${rate}px, 0)`;
        });
    }

    // Efecto de brillo en elementos interactivos
    function setupGlowEffect() {
        const interactiveElements = document.querySelectorAll('.nav-link, button, a.tutorial-card');
        
        interactiveElements.forEach(element => {
            element.addEventListener('mouseenter', function() {
                this.classList.add('glow-active');
            });
            
            element.addEventListener('mouseleave', function() {
                this.classList.remove('glow-active');
            });
        });
    }

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
