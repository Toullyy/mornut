import liff from '@line/liff'

export async function initLiff(): Promise<void> {
  await liff.init({ liffId: import.meta.env.VITE_LIFF_ID as string })
}

export { liff }
