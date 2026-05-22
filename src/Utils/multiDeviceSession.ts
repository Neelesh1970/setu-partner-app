/**
 * Module-level state for the multi-device test flow.
 *
 * Because @react-navigation/native-stack unmounts screens when they are not
 * focused, we cannot rely on component refs or navigation params for passing
 * data between the IOT screen and DeviceSelectScreen. Instead, IOT screens
 * write the completed booking_item_id here before calling navigation.goBack(),
 * and DeviceSelectScreen reads + clears it in useFocusEffect.
 */

let _pendingCompletedBookingItemId: string | null = null;

export function setPendingCompletedBookingItemId(id: string): void {
  _pendingCompletedBookingItemId = id;
}

export function consumePendingCompletedBookingItemId(): string | null {
  const id = _pendingCompletedBookingItemId;
  _pendingCompletedBookingItemId = null;
  return id;
}
