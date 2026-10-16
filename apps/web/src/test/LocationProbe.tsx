import { useLocation } from 'react-router-dom';

export function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}
