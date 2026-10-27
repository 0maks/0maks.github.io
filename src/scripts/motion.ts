// Scroll reveals, pointer tilt and the cursor glow. All of it is skipped under reduced motion.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (!reduce) {
	const root = document.documentElement;

	// Elements that fade up as they scroll into view. 'wipe' draws left to right, 'zoom' scales in.
	const targets: [string, string?][] = [
		['.section-head', 'wipe'],
		['.album .cover'],
		['.album > div'],
		['.gig'],
		['.favs .tile', 'zoom'],
		['.month > h2'],
		['.month li:not(.empty)', 'zoom'],
		['.ph', 'zoom'],
		['.card'],
		['.posts li'],
		['.hero'],
		['.layout > *'],
		['.post > *'],
		['.back, .pager'],
	];

	const seen = new Set<Element>();
	const items: HTMLElement[] = [];
	for (const [selector, kind] of targets) {
		document.querySelectorAll<HTMLElement>(`main ${selector.split(',').join(', main ')}`).forEach((el) => {
			if (seen.has(el) || el.closest('[data-reveal]')) return;
			seen.add(el);
			el.dataset.reveal = kind ?? '';
			items.push(el);
		});
	}

	const settle = (el: HTMLElement, delay: number) => {
		// Hand the element back to its own hover styles once the entrance has finished.
		setTimeout(() => {
			delete el.dataset.reveal;
			el.style.removeProperty('--d');
		}, delay + 1000);
	};

	// Stagger siblings that arrive in the same frame so grids ripple in rather than pop.
	const io = new IntersectionObserver(
		(entries) => {
			const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
			visible.forEach((e, i) => {
				const el = e.target as HTMLElement;
				const delay = Math.min(i, 6) * 55;
				el.style.setProperty('--d', `${delay}ms`);
				el.classList.add('in');
				settle(el, delay);
				io.unobserve(el);
			});
		},
		{ rootMargin: '0px 0px -8% 0px', threshold: 0 },
	);
	items.forEach((el) => io.observe(el));

	// Tilt + glare on covers.
	if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
		document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
			el.addEventListener('pointermove', (e) => {
				const r = el.getBoundingClientRect();
				const x = (e.clientX - r.left) / r.width;
				const y = (e.clientY - r.top) / r.height;
				el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
				el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
				el.style.setProperty('--mx', `${x * 100}%`);
				el.style.setProperty('--my', `${y * 100}%`);
				el.classList.add('tilting');
			});
			el.addEventListener('pointerleave', () => {
				el.classList.remove('tilting');
				el.style.setProperty('--rx', '0deg');
				el.style.setProperty('--ry', '0deg');
			});
		});

		// Cursor glow, eased towards the pointer.
		const glow = document.createElement('div');
		glow.className = 'glow';
		glow.setAttribute('aria-hidden', 'true');
		document.body.append(glow);

		let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
		const tick = () => {
			x += (tx - x) * 0.12;
			y += (ty - y) * 0.12;
			glow.style.transform = `translate3d(${x}px, ${y}px, 0)`;
			raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.5 ? requestAnimationFrame(tick) : 0;
		};
		addEventListener('pointermove', (e) => {
			tx = e.clientX;
			ty = e.clientY;
			if (!glow.classList.contains('on')) {
				x = tx;
				y = ty;
				glow.classList.add('on');
			}
			if (!raf) raf = requestAnimationFrame(tick);
		}, { passive: true });
		document.addEventListener('pointerleave', () => glow.classList.remove('on'));
	}
}
