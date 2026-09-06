interface CommonBrokenProps {
  tone?: 'quiet' | 'loud';
}

export interface BrokenProps extends CommonBrokenProps {}

function defineComponent<T>(render: (props: T) => unknown) {
  return render;
}

export const Broken = defineComponent<BrokenProps>(() => <div />);
