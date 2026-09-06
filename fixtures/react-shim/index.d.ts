export {};

declare global {
  namespace React {
    interface HTMLAttributes<T> {
      hidden?: boolean;
    }

    interface ButtonHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: boolean;
    }

    interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
      disabled?: boolean;
      readOnly?: boolean;
      checked?: boolean;
      required?: boolean;
    }
  }

  interface HTMLButtonElement {}
  interface HTMLInputElement {}
}
