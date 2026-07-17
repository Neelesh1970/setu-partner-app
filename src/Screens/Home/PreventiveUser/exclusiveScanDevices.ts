export const EXCLUSIVE_SCAN_DEVICE_IDS = new Set([
  '82d13697-8709-4ad0-b457-fa959fa316ae',
  '8ea18073-af8c-4152-8c68-e191715b95f3',
  '8e8d0da9-50ca-4b29-9d08-98cabf3d0ff6',
]);

type CartDeviceItem = {
  item_type?: string;
  item_id?: string | number | null;
  item?: {
    id?: string | number | null;
  } | null;
};

export function isExclusiveScanDevice(deviceId: unknown): boolean {
  if (deviceId == null) return false;
  return EXCLUSIVE_SCAN_DEVICE_IDS.has(String(deviceId));
}

export function cartContainsExclusiveScanDevice(
  cartItems: CartDeviceItem[] | null | undefined,
): boolean {
  if (!Array.isArray(cartItems)) return false;

  return cartItems.some(item => {
    if (item?.item_type !== 'device') return false;
    return isExclusiveScanDevice(item.item_id ?? item.item?.id);
  });
}

export function cartContainsAnyDevice(
  cartItems: CartDeviceItem[] | null | undefined,
): boolean {
  return Array.isArray(cartItems)
    ? cartItems.some(item => item?.item_type === 'device')
    : false;
}

export function shouldBlockDeviceAddDueToExclusiveScan(
  cartItems: CartDeviceItem[] | null | undefined,
  deviceIdToAdd: unknown,
): boolean {
  const hasExclusive = cartContainsExclusiveScanDevice(cartItems);
  const addingExclusive = isExclusiveScanDevice(deviceIdToAdd);

  if (hasExclusive) return true;
  if (addingExclusive && cartContainsAnyDevice(cartItems)) return true;

  return false;
}
