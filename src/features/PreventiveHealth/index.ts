import { createAsyncThunk } from '@reduxjs/toolkit';
import type { AppDispatch, RootState } from '../../store';
import type { CartItem } from '../cart/cartSlice';
import {
  deletePatientAsync,
  fetchPatients,
  type PreventiveState,
} from '../preventive/preventiveSlice';

export type { PreventivePatientListItem } from '../../Screens/Home/PreventiveUser/PreventiveHealthAPI';

export {
  fetchPatients,
  deletePatientAsync,
};

export const selectPatientsList = (state: RootState) => state.preventive.patients.list;

export const selectPatientsLoading = (state: RootState) => state.preventive.patients.loading;

export const selectCartItems = (state: RootState): CartItem[] => state.cart.items;

export async function resolveFetchPatientsList(
  dispatch: AppDispatch,
  getState: () => RootState,
  opts?: { force?: boolean },
) {
  const force = opts?.force;
  const { list, loading } = (getState().preventive as PreventiveState).patients;
  if (!force && list.length > 0) {
    return list;
  }
  if (!force && loading) {
    return list;
  }
  return dispatch(fetchPatients({ force })).unwrap();
}
