import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Platform,
  useWindowDimensions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ms, vs } from 'react-native-size-matters';

import { COLORS } from '../../Constants/theme';

const HORIZONTAL_INSET = ms(12);
const SHELL_TOP = vs(6);
const SHELL_BOTTOM = vs(12);
const MAX_VIEWPORT_RATIO = 0.84;

export type ReportPdfViewerStyles = {
  reportViewerShell: ViewStyle;
  viewerLoadingOverlay: ViewStyle;
  reportCenter: ViewStyle;
  reportHint: TextStyle;
  reportErrorTitle: TextStyle;
  reportErrorMsg: TextStyle;
  reportRetryBtn: ViewStyle;
  reportRetryText: TextStyle;
};

type ReportPdfViewerProps = {
  reportUrl: string;
  reportBookingId: string;
  reportNonce: number;
  viewerLoading: boolean;
  /** When false, overlay shows only a spinner (TestActivity compact style). */
  showOpeningHint?: boolean;
  onViewerLoadingChange: (loading: boolean) => void;
  onViewerError: () => void;
  onOpenInBrowser: () => void;
  onClose: () => void;
  styles: ReportPdfViewerStyles;
};

type PageLayout = {
  width: number;
  height: number;
  pageCount: number;
};

function safeCacheFileName(bookingId: string): string {
  const safe = bookingId.replace(/[^a-zA-Z0-9-]/g, '_').slice(0, 64);
  return `report-${safe || 'unknown'}.pdf`;
}

const localStyles = StyleSheet.create({
  shellContent: {
    flex: 1,
    paddingHorizontal: HORIZONTAL_INSET,
    paddingTop: SHELL_TOP,
    paddingBottom: SHELL_BOTTOM,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: ms(12),
    overflow: 'hidden',
    alignSelf: 'stretch',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: ms(8),
      },
      android: {
        elevation: 3,
      },
    }),
  },
  pdf: {
    backgroundColor: COLORS.WHITE,
  },
  loadingBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(24),
  },
  loadingHint: {
    marginTop: vs(10),
    fontSize: ms(13),
    color: '#6B7280',
    fontWeight: '500',
  },
});

const ReportPdfViewer: React.FC<ReportPdfViewerProps> = ({
  reportUrl,
  reportBookingId,
  reportNonce,
  viewerLoading,
  showOpeningHint = true,
  onViewerLoadingChange,
  onViewerError,
  onOpenInBrowser,
  onClose,
  styles,
}) => {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [pageLayout, setPageLayout] = useState<PageLayout | null>(null);
  const activeLoadRef = useRef({ reportUrl, reportBookingId, reportNonce });

  const Pdf = useMemo(() => {
    try {
      return require('react-native-pdf').default as React.ComponentType<{
        source: { uri: string; cache?: boolean; cacheFileName?: string };
        style: { width: number; height: number; backgroundColor: string };
        trustAllCerts?: boolean;
        enableDoubleTapZoom?: boolean;
        fitPolicy?: 0 | 1 | 2;
        spacing?: number;
        showsVerticalScrollIndicator?: boolean;
        onLoadProgress?: (percent: number) => void;
        onLoadComplete?: (
          numberOfPages: number,
          path: string,
          size: { height: number; width: number },
        ) => void;
        onError?: (error: object) => void;
        renderActivityIndicator?: (progress: number) => React.ReactElement;
        progressContainerStyle?: ViewStyle;
      }>;
    } catch (e) {
      return null;
    }
  }, []);

  useEffect(() => {
    activeLoadRef.current = { reportUrl, reportBookingId, reportNonce };
    setPageLayout(null);
  }, [reportUrl, reportBookingId, reportNonce]);

  const pdfSource = useMemo(
    () => ({
      uri: reportUrl,
      cache: true,
      cacheFileName: safeCacheFileName(reportBookingId),
    }),
    [reportUrl, reportBookingId],
  );

  const viewerKey = `report-${reportBookingId}-${reportNonce}`;

  const contentWidth = windowWidth - HORIZONTAL_INSET * 2;
  const maxViewportHeight = windowHeight * MAX_VIEWPORT_RATIO;

  const viewerHeight = useMemo(() => {
    if (!pageLayout?.width || !pageLayout?.height) {
      return Math.min(maxViewportHeight, vs(420));
    }
    const pageHeight = (contentWidth * pageLayout.height) / pageLayout.width;
    if (pageLayout.pageCount > 1) {
      return maxViewportHeight;
    }
    return Math.min(pageHeight, maxViewportHeight);
  }, [contentWidth, maxViewportHeight, pageLayout]);

  const isStaleLoad = useCallback(
    (url: string, bookingId: string, nonce: number) => {
      const active = activeLoadRef.current;
      return (
        active.reportUrl !== url ||
        active.reportBookingId !== bookingId ||
        active.reportNonce !== nonce
      );
    },
    [],
  );

  const handleLoadProgress = useCallback(
    (percent: number) => {
      if (percent < 100 && !isStaleLoad(reportUrl, reportBookingId, reportNonce)) {
        onViewerLoadingChange(true);
      }
    },
    [isStaleLoad, onViewerLoadingChange, reportBookingId, reportNonce, reportUrl],
  );

  const handleLoadComplete = useCallback(
    (numberOfPages: number, _path: string, size: { height: number; width: number }) => {
      if (isStaleLoad(reportUrl, reportBookingId, reportNonce)) {
        return;
      }
      if (size?.width && size?.height) {
        setPageLayout({
          width: size.width,
          height: size.height,
          pageCount: numberOfPages,
        });
      }
      onViewerLoadingChange(false);
    },
    [isStaleLoad, onViewerLoadingChange, reportBookingId, reportNonce, reportUrl],
  );

  const handleError = useCallback(
    (error: object) => {
      if (isStaleLoad(reportUrl, reportBookingId, reportNonce)) {
        return;
      }
      onViewerLoadingChange(false);
      onViewerError();
    },
    [isStaleLoad, onViewerError, onViewerLoadingChange, reportBookingId, reportNonce, reportUrl],
  );

  if (!Pdf) {
    return (
      <View style={styles.reportCenter}>
        <Text style={styles.reportErrorTitle}>Unable to open report</Text>
        <Text style={styles.reportErrorMsg}>
          Report viewer native module is missing. Please rebuild the app, or open the report in the
          browser.
        </Text>
        <Pressable style={styles.reportRetryBtn} onPress={onOpenInBrowser}>
          <Text style={styles.reportRetryText}>Open in browser</Text>
        </Pressable>
        <Pressable style={styles.reportRetryBtn} onPress={onClose}>
          <Text style={styles.reportRetryText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.reportViewerShell}>
      <View style={localStyles.shellContent}>
        <View style={localStyles.card}>
          <Pdf
            key={viewerKey}
            source={pdfSource}
            style={{
              ...localStyles.pdf,
              width: contentWidth,
              height: viewerHeight,
            }}
            trustAllCerts={false}
            enableDoubleTapZoom
            fitPolicy={0}
            spacing={0}
            showsVerticalScrollIndicator
            progressContainerStyle={styles.reportCenter}
            onLoadProgress={handleLoadProgress}
            onLoadComplete={handleLoadComplete}
            onError={handleError}
            renderActivityIndicator={() => (
              <View style={localStyles.loadingBlock}>
                <ActivityIndicator color={COLORS.PRIMARY} size="large" />
                {showOpeningHint ? <Text style={localStyles.loadingHint}>Opening…</Text> : null}
              </View>
            )}
          />
        </View>
      </View>
      {viewerLoading ? (
        <View style={styles.viewerLoadingOverlay} pointerEvents="none">
          <ActivityIndicator color={COLORS.WHITE} size={showOpeningHint ? 'large' : 'small'} />
          {showOpeningHint ? <Text style={styles.reportHint}>Opening…</Text> : null}
        </View>
      ) : null}
    </View>
  );
};

export default ReportPdfViewer;
