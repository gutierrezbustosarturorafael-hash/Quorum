import React, { useRef, useState } from 'react';
import './SlideCommit.css';

const SlideCommit = ({
  label = 'Desliza para confirmar',
  doneLabel = 'Confirmado',
  errorLabel = 'No se pudo completar',
  onConfirm,
  onDone,
  onError,
  trackColor = '#e5e7eb',
  handleColor = '#111827',
  successColor = '#16a34a',
  dangerColor = '#dc2626',
  width = 260,
  height = 52,
  radius = 26,
  holdMs = 1200,
  disabled = false
}) => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const rootRef = useRef(null);
  const pointerIdRef = useRef(null);

  const reset = () => {
    setProgress(0);
    setStatus('idle');
    setErrorMessage('');
  };

  const confirm = async () => {
    if (status === 'busy' || status === 'done' || disabled) return;
    setProgress(100);
    setStatus('busy');
    setErrorMessage('');
    const startedAt = Date.now();
    try {
      const resultPromise = Promise.resolve().then(() => onConfirm?.())
        .then(value => ({ value }), error => ({ error }));
      const [result] = await Promise.all([
        resultPromise,
        new Promise(resolve => window.setTimeout(resolve, 300))
      ]);
      if (result.error) throw result.error;
      const remainingHold = Math.max(0, holdMs - (Date.now() - startedAt));
      if (remainingHold) await new Promise(resolve => window.setTimeout(resolve, remainingHold));
      setStatus('done');
      onDone?.();
    } catch (error) {
      setStatus('error');
      setProgress(0);
      setErrorMessage(error?.message || errorLabel);
      onError?.(error);
    }
  };

  const updateProgressFromPointer = event => {
    if (!rootRef.current || pointerIdRef.current !== event.pointerId) return;
    const bounds = rootRef.current.getBoundingClientRect();
    const handleWidth = height;
    const availableWidth = Math.max(1, bounds.width - handleWidth);
    const nextProgress = Math.max(0, Math.min(100, ((event.clientX - bounds.left - handleWidth / 2) / availableWidth) * 100));
    setProgress(nextProgress);
  };

  const handlePointerDown = event => {
    if (disabled || status !== 'idle') return;
    pointerIdRef.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateProgressFromPointer(event);
  };

  const handlePointerUp = event => {
    if (pointerIdRef.current !== event.pointerId) return;
    updateProgressFromPointer(event);
    pointerIdRef.current = null;
    const bounds = rootRef.current?.getBoundingClientRect();
    const handleWidth = height;
    const ratio = bounds
      ? Math.max(0, Math.min(1, (event.clientX - bounds.left - handleWidth / 2) / Math.max(1, bounds.width - handleWidth)))
      : 0;
    if (ratio >= 0.88) {
      confirm();
    } else {
      setProgress(0);
    }
  };

  const handleKeyDown = event => {
    if (disabled || status !== 'idle') return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      setProgress(value => Math.min(100, value + 10));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      setProgress(value => Math.max(0, value - 10));
    } else if (event.key === 'End' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      confirm();
    } else if (event.key === 'Home' || event.key === 'Escape') {
      event.preventDefault();
      reset();
    }
  };

  const completeLabel = typeof label === 'string' ? label : 'Desliza para confirmar';
  const currentLabel = status === 'done'
    ? doneLabel
    : status === 'error'
      ? errorLabel
      : status === 'busy'
        ? 'Guardando...'
        : completeLabel;
  const isDisabled = disabled || status === 'busy' || status === 'done';

  return (
    <div className="slide-commit-wrap">
      <div
        ref={rootRef}
        className={`slide-commit slide-commit-${status}`}
        role="slider"
        aria-label={completeLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        aria-valuetext={status === 'done' ? doneLabel : status === 'error' ? errorMessage || errorLabel : completeLabel}
        aria-busy={status === 'busy'}
        aria-disabled={isDisabled}
        tabIndex={isDisabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onPointerDown={handlePointerDown}
        onPointerMove={updateProgressFromPointer}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          pointerIdRef.current = null;
          setProgress(0);
        }}
        style={{
          '--sc-track': trackColor,
          '--sc-handle': handleColor,
          '--sc-success': successColor,
          '--sc-danger': dangerColor,
          '--sc-progress': `${progress}%`,
          '--sc-width': `${width}px`,
          '--sc-height': `${height}px`,
          '--sc-radius': `${radius}px`
        }}
      >
        <span className="slide-commit-label" aria-hidden="true">{currentLabel}</span>
        <span
          className="slide-commit-handle"
          style={{ transform: `translateX(calc(${progress}% - ${progress * height / 100}px))` }}
          aria-hidden="true"
        >
          {status === 'busy' ? <span className="slide-commit-spinner" /> : status === 'done' ? '✓' : status === 'error' ? '!' : '›'}
        </span>
        <span className="visually-hidden">Usa las flechas para deslizar, Inicio para reiniciar y Fin para confirmar.</span>
      </div>
      {status === 'error' && (
        <div className="slide-commit-error" role="alert">
          {errorMessage || errorLabel}
          <button type="button" onClick={reset}>Intentar de nuevo</button>
        </div>
      )}
    </div>
  );
};

export default SlideCommit;
