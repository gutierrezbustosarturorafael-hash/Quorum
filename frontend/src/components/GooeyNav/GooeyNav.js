import { useEffect, useRef, useState } from 'react';
import './GooeyNav.css';

const noise = (amount = 1) => amount / 2 - Math.random() * amount;

const GooeyNav = ({
  items = [],
  activeIndex = 0,
  onItemSelect,
  animationTime = 600,
  particleCount = 12,
  particleDistances = [70, 10],
  particleR = 90,
  timeVariance = 220,
  colors = [1, 2, 3, 1, 2, 3]
}) => {
  const containerRef = useRef(null);
  const navRef = useRef(null);
  const filterRef = useRef(null);
  const textRef = useRef(null);
  const [effectIndex, setEffectIndex] = useState(activeIndex);

  useEffect(() => {
    setEffectIndex(activeIndex);
  }, [activeIndex]);

  const updateEffectPosition = element => {
    if (!containerRef.current || !filterRef.current || !textRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const styles = {
      left: `${rect.x - containerRect.x}px`,
      top: `${rect.y - containerRect.y}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`
    };
    Object.assign(filterRef.current.style, styles);
    Object.assign(textRef.current.style, styles);
    textRef.current.innerText = element.innerText;
  };

  const createParticle = (element, index) => {
    const distance = particleDistances;
    const angle = ((360 + noise(8)) / particleCount) * index * (Math.PI / 180);
    const endAngle = ((360 + noise(8)) / particleCount) * index * (Math.PI / 180);
    const time = animationTime * 2 + noise(timeVariance * 2);
    const particle = document.createElement('span');
    const point = document.createElement('span');

    particle.className = 'gooey-particle';
    particle.style.setProperty('--start-x', `${distance[0] * Math.cos(angle)}px`);
    particle.style.setProperty('--start-y', `${distance[0] * Math.sin(angle)}px`);
    particle.style.setProperty('--end-x', `${(distance[1] + noise(7)) * Math.cos(endAngle)}px`);
    particle.style.setProperty('--end-y', `${(distance[1] + noise(7)) * Math.sin(endAngle)}px`);
    particle.style.setProperty('--time', `${time}ms`);
    particle.style.setProperty('--scale', `${1 + noise(0.2)}`);
    particle.style.setProperty('--color', `var(--gooey-color-${colors[index % colors.length]})`);
    particle.style.setProperty('--rotate', `${noise(particleR / 10) * 10}deg`);
    point.className = 'gooey-point';
    particle.appendChild(point);
    element.appendChild(particle);
    requestAnimationFrame(() => element.classList.add('active'));
    window.setTimeout(() => particle.remove(), time);
  };

  const handleClick = (event, index) => {
    event.preventDefault();
    const item = event.currentTarget.parentElement;
    setEffectIndex(index);
    updateEffectPosition(item);
    onItemSelect(index);

    if (filterRef.current) {
      filterRef.current.querySelectorAll('.gooey-particle').forEach(particle => particle.remove());
      for (let i = 0; i < particleCount; i += 1) {
        window.setTimeout(() => createParticle(filterRef.current, i), 30);
      }
    }
    if (textRef.current) {
      textRef.current.classList.remove('active');
      void textRef.current.offsetWidth;
      textRef.current.classList.add('active');
    }
  };

  useEffect(() => {
    const activeItem = navRef.current?.querySelectorAll('li')[effectIndex];
    if (activeItem) updateEffectPosition(activeItem);
    const observer = new ResizeObserver(() => {
      const currentItem = navRef.current?.querySelectorAll('li')[effectIndex];
      if (currentItem) updateEffectPosition(currentItem);
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [effectIndex]);

  return (
    <div className="gooey-nav-container" ref={containerRef}>
      <nav>
        <ul ref={navRef}>
          {items.map((item, index) => (
            <li key={item.key || item.label} className={effectIndex === index ? 'active' : ''}>
              <button
                type="button"
                title={item.title || item.label}
                aria-label={item.ariaLabel || item.label}
                aria-current={activeIndex === index ? 'page' : undefined}
                onClick={event => handleClick(event, index)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <span className="gooey-effect filter" ref={filterRef} />
      <span className="gooey-effect text" ref={textRef} />
    </div>
  );
};

export default GooeyNav;
