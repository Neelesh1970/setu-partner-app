/** Shared with POST /identity-verification (see authService.submitIdentityVerification). */

export type IdProofTypeApi = 'AADHAR' | 'PAN' | 'VOTER_ID';

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
}
