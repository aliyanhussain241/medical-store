/**
 * Keyboard Navigation Utility for POS / Fast Cashier Billing & Forms
 * Allows users to press 'Enter' to advance to the next field seamlessly across the entire app.
 */

export function handleEnterNext(e, nextTargetOrFn) {
  if (e.key !== 'Enter') return;
  // Ignore inside multi-line textareas unless Ctrl is held
  if (e.target.tagName === 'TEXTAREA' && !e.ctrlKey) return;

  e.preventDefault();

  if (typeof nextTargetOrFn === 'string') {
    const el = document.getElementById(nextTargetOrFn);
    if (el) {
      el.focus();
      if (typeof el.select === 'function') el.select();
      return;
    }
  } else if (typeof nextTargetOrFn === 'function') {
    nextTargetOrFn();
    return;
  }

  // Fallback: automatically find the next input/select/button in the active container
  autoAdvanceNext(e.target);
}

export function autoAdvanceNext(currentElement) {
  const container =
    currentElement.closest('form') ||
    currentElement.closest('.modal-body') ||
    currentElement.closest('.modal') ||
    currentElement.closest('.card-body') ||
    currentElement.closest('.pos-layout') ||
    document.body;

  const selector =
    'input:not([disabled]):not([type="hidden"]):not([readonly]), select:not([disabled]), button.btn-brand:not([disabled]), button[type="submit"]:not([disabled])';
  const focusables = Array.from(container.querySelectorAll(selector));
  const currentIndex = focusables.indexOf(currentElement);

  if (currentIndex >= 0 && currentIndex < focusables.length - 1) {
    const nextTarget = focusables[currentIndex + 1];
    nextTarget.focus();
    if (typeof nextTarget.select === 'function') nextTarget.select();
  }
}

/**
 * Universal Form-level handler:
 * Attach `onKeyDown={(e) => handleFormEnterKey(e, handleSave)}` to any <form> or modal <div>.
 * Pressing Enter on any input automatically moves to the next input,
 * and pressing Enter on the final input triggers `onSave`!
 */
export function handleFormEnterKey(e, onSave) {
  if (e.key !== 'Enter') return;
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.target.tagName === 'BUTTON') return;

  e.preventDefault();
  const container = e.currentTarget;
  const selector =
    'input:not([disabled]):not([type="hidden"]), select:not([disabled]), button.btn-brand:not([disabled]), button[type="submit"]:not([disabled])';
  const focusables = Array.from(container.querySelectorAll(selector));
  const currentIndex = focusables.indexOf(e.target);

  if (currentIndex >= 0 && currentIndex < focusables.length - 1) {
    const next = focusables[currentIndex + 1];
    next.focus();
    if (typeof next.select === 'function') next.select();
  } else if (currentIndex === focusables.length - 1 && typeof onSave === 'function') {
    onSave();
  }
}
