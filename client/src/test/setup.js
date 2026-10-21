import '@testing-library/jest-dom/vitest';

// jsdom does not implement <dialog> methods yet.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
  HTMLDialogElement.prototype.close ||= function close() { this.open = false; };
}
URL.createObjectURL ||= () => 'blob:preview';
URL.revokeObjectURL ||= () => {};
