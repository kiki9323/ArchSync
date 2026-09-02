import type { CommonButtonProps } from './button.types';

export interface ButtonProps extends CommonButtonProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

export const Button = defineComponent<ButtonProps>(
  ({
    variant = 'filled',
    size = 'md',
    rounded = 'none',
    fullWidth = false,
    isLoading = false,
  }) => {
    return isLoading ? null : fullWidth && null;
  },
);
