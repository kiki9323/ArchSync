type CardProps = {
  title: string;
};

export function Card({ title }: CardProps) {
  return <article>{title}</article>;
}
