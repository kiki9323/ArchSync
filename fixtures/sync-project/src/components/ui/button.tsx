interface CommonButtonProps {
  variant?: 'filled' | 'outline';
}

export interface ButtonProps extends CommonButtonProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

export const Button = defineComponent<ButtonProps>(
  ({ variant = 'filled' }) => <button data-variant={variant} />,
);
