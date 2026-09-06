export interface CommonButtonProps {
  isLoading?: boolean;
  fullWidth?: boolean;
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    CommonButtonProps {}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Button = ({ disabled, ...props }: ButtonProps) => (
  <button disabled={disabled} {...props} />
);

export const Input = ({ readOnly, ...props }: InputProps) => (
  <input readOnly={readOnly} {...props} />
);
