# Redux Toolkit Templates

## src/store/index.ts

```ts
import { combineReducers, configureStore, createAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import { layoutReducer } from './layout.slice';

export const resetStore = createAction('app/reset');

const appReducer = combineReducers({
  layout: layoutReducer,
  // add feature slices here
});

const rootReducer: typeof appReducer = (state, action) =>
  appReducer(resetStore.match(action) ? undefined : state, action);

export const store = configureStore({ reducer: rootReducer });

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
```

Dispatch `resetStore()` on logout (together with `queryClient.clear()` and `clearUserStorage(userId)`).

## src/store/layout.slice.ts (global client state example)

```ts
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './index';

interface LayoutState {
  sidebarCollapsed: boolean;
  density: 'compact' | 'comfortable';
}

const initialState: LayoutState = {
  sidebarCollapsed: false,
  density: 'comfortable',
};

const layoutSlice = createSlice({
  name: 'layout',
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setDensity(state, action: PayloadAction<LayoutState['density']>) {
      state.density = action.payload;
    },
  },
});

export const { toggleSidebar, setDensity } = layoutSlice.actions;
export const layoutReducer = layoutSlice.reducer;

export const selectSidebarCollapsed = (s: RootState) => s.layout.sidebarCollapsed;
export const selectDensity = (s: RootState) => s.layout.density;
```

## Persisting one preference (not the whole store)

```ts
// in a small listener or component effect
const density = useAppSelector(selectDensity);
useEffect(() => tableDensity(user.id).set(density), [density, user.id]);

// initial state hydration at login
dispatch(setDensity(tableDensity(user.id).get()));
```

## Not allowed

```ts
// ❌ API data in Redux
const projectsSlice = createSlice({ name: 'projects', initialState: { items: [] as Project[] }, ... });
// ✅ use useProjectsQuery() instead
```
