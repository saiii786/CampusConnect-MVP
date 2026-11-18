import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './button';

// Note: Testing Library v14 — render() and events are async and must be awaited.
describe('Button', () => {
  it('is announced as a button and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire while loading and reports busy to screen readers', async () => {
    const onPress = jest.fn();
    await render(<Button label="Save" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
  });
});
