interface CommonOutsideProps {
  enabled?: boolean;
}

export interface OutsideProps extends CommonOutsideProps {}

export const Outside = (_props: OutsideProps) => <section />;
