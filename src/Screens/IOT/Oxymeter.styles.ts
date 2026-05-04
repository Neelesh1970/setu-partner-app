import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c162a',
  },
  scrollArea: {
    paddingBottom: 32,
  },
  stackBackRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  stackBackText: {
    color: '#7dd3fc',
    fontSize: 16,
    fontWeight: '600',
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
  },
  heroTitle: {
    color: '#f8fafc',
    fontSize: 28,
    fontWeight: '700',
  },
  heroSubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  ctaButton: {
    marginTop: 18,
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaButtonText: {
    color: '#0c162a',
    fontSize: 16,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionTagline: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
    maxWidth: 260,
  },
  sectionAction: {
    color: '#7dd3fc',
    fontSize: 14,
    fontWeight: '600',
  },
  deviceList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#152238',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  deviceCardActive: {
    borderColor: '#38bdf8',
  },
  deviceIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  deviceCopy: {
    flex: 1,
    minWidth: 0,
  },
  deviceName: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 4,
  },
  deviceBadge: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  deviceBadgeText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '600',
  },
  deviceScreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    paddingVertical: 8,
    paddingRight: 12,
  },
  backButtonText: {
    color: '#7dd3fc',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonPlaceholder: {
    width: 72,
  },
  deviceScreenTitle: {
    flex: 1,
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
  },
  deviceDetail: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  deviceDetailHeading: {
    marginBottom: 12,
  },
  deviceDetailTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
  },
  deviceDetailType: {
    color: '#7dd3fc',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  deviceDetailBody: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 20,
  },
  metricCard: {
    backgroundColor: '#152238',
    borderRadius: 12,
    padding: 14,
    minWidth: '30%',
    flexGrow: 1,
  },
  metricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  metricValue: {
    color: '#f8fafc',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 6,
  },
  connectButton: {
    marginTop: 24,
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectButtonDisabled: {
    opacity: 0.55,
  },
  connectButtonText: {
    color: '#0c162a',
    fontSize: 16,
    fontWeight: '700',
  },
  helpText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
    textAlign: 'center',
  },
  statusCard: {
    marginTop: 20,
    backgroundColor: '#152238',
    borderRadius: 14,
    padding: 16,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusValue: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 8,
  },
  statusLine: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
  },
  oximeterScreenBase: {
    flex: 1,
    backgroundColor: '#0c162a',
  },
  oximeterScreen: {
    flex: 1,
  },
  oximeterHero: {
    alignItems: 'center',
    marginBottom: 20,
  },
  oximeterLabel: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  oximeterDeviceWrap: {
    alignItems: 'center',
  },
  oximeterDeviceShell: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#152238',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  oximeterWave: {
    width: 72,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.35)',
  },
  oximeterMetrics: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  oximeterMetricsStacked: {
    flexDirection: 'column',
  },
  oximeterMetricStackedSpacing: {
    marginTop: 12,
    marginLeft: 0,
  },
  oximeterMetricCard: {
    flex: 1,
    backgroundColor: '#152238',
    borderRadius: 14,
    padding: 16,
    minWidth: 0,
  },
  oximeterMetricPrimary: {
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.4)',
  },
  oximeterMetricLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
  },
  oximeterMetricValue: {
    color: '#f8fafc',
    fontSize: 32,
    fontWeight: '700',
    marginTop: 8,
  },
  oximeterMetricUnit: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 4,
  },
  oximeterSetupCard: {
    backgroundColor: '#152238',
    borderRadius: 20,
    marginHorizontal: 16,
    marginVertical: 12,
  },
  oximeterSetupHeader: {
    alignItems: 'center',
    paddingTop: 20,
  },
  oximeterBody: {
    paddingTop: 8,
  },
  oximeterTitle: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  oximeterCopy: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  oximeterConnectButton: {
    backgroundColor: '#38bdf8',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  oximeterConnectButtonText: {
    color: '#0c162a',
    fontSize: 16,
    fontWeight: '700',
  },
});
