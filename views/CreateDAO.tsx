import React, { useEffect, useState } from 'react';
import { ChevronRight, ChevronLeft, Shield, CheckCircle, Loader2, Upload, MapPin } from 'lucide-react';
import { useWallets } from "@privy-io/react-auth";
import { addMemberToDao, createDaoOnFactory, updateDaoInfoOnchain, type PrivyEthereumWallet } from "../utils/localDaoContracts";
import { maskAddress } from '../utils/address';
import { uploadImageToIpfs } from '../utils/ipfs';
import { getTxExplorerUrl, hasBackupExplorer } from '../utils/explorer';
import { APP_CHAIN_ID, APP_CHAIN_NAME } from '../utils/contract';

interface CreateDAOProps {
  onComplete: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const normalizeCreateDaoError = (error: unknown): string => {
  const fallback = "Failed to create DAO. Please try again.";
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();

  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: string | number }).code)
      : "";

  if (
    code === "4001" ||
    lower.includes("user rejected") ||
    lower.includes("user denied") ||
    lower.includes("rejected the request") ||
    lower.includes("denied transaction signature")
  ) {
    return "Transaction cancelled in wallet. Confirm the transaction to deploy your DAO.";
  }

  if (lower.includes("insufficient funds")) {
    return "Insufficient AVAX for gas. Fund your wallet and retry.";
  }

  if (
    lower.includes("chain") &&
    (lower.includes("mismatch") || lower.includes("unsupported") || lower.includes("switch"))
  ) {
    return `Wrong network selected. Switch your wallet to ${APP_CHAIN_NAME} (${APP_CHAIN_ID}) and retry.`;
  }

  if (lower.includes("no usable ethereum wallet found") || lower.includes("no ethereum wallet found")) {
    return "No Ethereum wallet detected in Privy. Connect an EVM wallet and retry.";
  }

  if (lower.includes("execution reverted")) {
    return "Contract call reverted. Recheck required fields and wallet permissions, then retry.";
  }

  return message || fallback;
};

const CreateDAO: React.FC<CreateDAOProps> = ({ onComplete }) => {
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [txHash, setTxHash] = useState('');
  const [createdDaoAddress, setCreatedDaoAddress] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [logoIpfsUri, setLogoIpfsUri] = useState('');
  const [deployNotice, setDeployNotice] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    coordinates: '',
    postalCode: '',
    focus: '',
    votingSystem: 'token-weighted',
    threshold: 51,
    period: 7,
    minInvestment: 1000,
    membershipType: 'open',
    kycRequired: true,
    maxMembers: '100',
  });
  const { wallets } = useWallets();

  useEffect(() => {
    const saved = localStorage.getItem('localdao_create_progress');
    if (saved) setFormData(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('localdao_create_progress', JSON.stringify(formData));
  }, [formData]);

  useEffect(() => {
    return () => {
      if (logoPreview) URL.revokeObjectURL(logoPreview);
    };
  }, [logoPreview]);

  const validateStep = (targetStep: Step): string => {
    if (targetStep === 1) {
      if (!formData.name.trim()) return 'DAO name is required.';
      if (!formData.location.trim()) return 'Location is required.';
      if (!formData.description.trim()) return 'Description is required.';
      if (!formData.coordinates.trim()) return 'Coordinates are required.';
      if (!formData.postalCode.trim()) return 'Postal code is required.';
      if (!formData.focus.trim()) return 'Select an investment focus.';
    }
    if (targetStep === 2) {
      if (!Number.isFinite(formData.threshold) || formData.threshold < 1 || formData.threshold > 100) {
        return 'Proposal threshold must be between 1 and 100.';
      }
      if (!Number.isFinite(formData.period) || formData.period < 1) {
        return 'Voting period must be at least 1 day.';
      }
      if (!Number.isFinite(formData.minInvestment) || formData.minInvestment <= 0) {
        return 'Minimum investment must be greater than zero.';
      }
    }
    if (targetStep === 3) {
      const maxMembership = Number(formData.maxMembers || 0);
      if (!Number.isFinite(maxMembership) || maxMembership <= 0) {
        return 'Maximum members must be greater than zero.';
      }
    }
    return '';
  };

  const handleNext = () => {
    const message = validateStep(step);
    if (message) {
      setErrorMessage(message);
      return;
    }
    setErrorMessage('');
    setStep((prev) => (prev + 1) as Step);
  };

  const handleBack = () => {
    setErrorMessage('');
    setStep((prev) => (prev - 1) as Step);
  };

  const handleUseCurrentLocation = async () => {
    setErrorMessage('');
    setLocationStatus('');

    if (!window.isSecureContext) {
      setLocationStatus('Location requires secure context (https or localhost).');
      return;
    }
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by this browser.');
      return;
    }

    setLocationLoading(true);
    try {
      const requestPosition = (options: PositionOptions) =>
        new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });

      let position: GeolocationPosition | null = null;
      let geoError: unknown = null;
      try {
        position = await requestPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      } catch (err) {
        geoError = err;
        try {
          position = await requestPosition({
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 60000,
          });
        } catch (err2) {
          geoError = err2;
        }
      }

      if (!position) {
        // Fallback: approximate location from IP when precise geolocation fails.
        const ipResponse = await fetch('https://ipapi.co/json/');
        if (!ipResponse.ok) {
          throw geoError ?? new Error('Location unavailable');
        }
        const ipPayload = (await ipResponse.json()) as {
          latitude?: number;
          longitude?: number;
          city?: string;
          region?: string;
          country_name?: string;
          postal?: string;
        };

        if (
          typeof ipPayload.latitude === 'number' &&
          typeof ipPayload.longitude === 'number'
        ) {
          const coordinates = `${ipPayload.latitude.toFixed(6)},${ipPayload.longitude.toFixed(6)}`;
          const location = [ipPayload.city, ipPayload.region || ipPayload.country_name]
            .filter(Boolean)
            .join(', ');
          setFormData((prev) => ({
            ...prev,
            coordinates,
            location: location || prev.location,
            postalCode: ipPayload.postal || prev.postalCode,
          }));
          setLocationStatus('Approximate location auto-filled from network (IP).');
          return;
        }

        throw geoError ?? new Error('Location unavailable');
      }

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const coordinates = `${lat.toFixed(6)},${lon.toFixed(6)}`;

      setFormData((prev) => ({ ...prev, coordinates }));
      setLocationStatus('Coordinates detected. Fetching address details...');

      let derivedLocation = '';
      let derivedPostal = '';

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 9000);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}`,
          {
            signal: controller.signal,
            headers: {
              Accept: 'application/json',
            },
          }
        );
        clearTimeout(timeoutId);

        if (response.ok) {
          const payload = (await response.json()) as {
            address?: {
              city?: string;
              town?: string;
              village?: string;
              county?: string;
              state?: string;
              country?: string;
              postcode?: string;
            };
          };
          const address = payload.address;
          if (address) {
            const locality = address.city || address.town || address.village || address.county || '';
            const region = address.state || address.country || '';
            derivedLocation = [locality, region].filter(Boolean).join(', ');
            derivedPostal = address.postcode || '';
          }
        }
      } catch {
        setLocationStatus('Coordinates set. Address lookup failed; you can fill location/postal manually.');
      }

      setFormData((prev) => ({
        ...prev,
        location: derivedLocation || prev.location,
        postalCode: derivedPostal || prev.postalCode,
      }));

      if (derivedLocation || derivedPostal) {
        setLocationStatus('Location details auto-filled.');
      }
    } catch (err) {
      let message = 'Failed to fetch current location.';
      if (err && typeof err === 'object' && 'code' in err) {
        const code = (err as GeolocationPositionError).code;
        if (code === 1) message = 'Location permission denied. Allow location access in browser settings.';
        if (code === 2) message = 'Location unavailable on this device/network. Enter details manually.';
        if (code === 3) message = 'Location request timed out. Try again or fill details manually.';
      } else if (err instanceof Error) {
        message = `Location fetch failed: ${err.message}`;
      }
      setLocationStatus(message);
    } finally {
      setLocationLoading(false);
    }
  };

  const handleDeploy = async () => {
    setErrorMessage('');
    setDeployNotice('');
    setLoading(true);

    try {
      const ethereumWallet =
        wallets.find((wallet) => {
          const maybeWallet = wallet as unknown as {
            type?: string;
            chainType?: string;
            address?: string;
            switchChain?: unknown;
            getEthereumProvider?: unknown;
          };
          const isEvmType =
            maybeWallet.type === "ethereum" || maybeWallet.chainType === "ethereum";
          const hasSignerFns =
            typeof maybeWallet.switchChain === "function" &&
            typeof maybeWallet.getEthereumProvider === "function";
          const hasEvmAddress =
            typeof maybeWallet.address === "string" &&
            maybeWallet.address.toLowerCase().startsWith("0x");
          return isEvmType && hasSignerFns && hasEvmAddress;
        }) ??
        wallets.find((wallet) => {
          const maybeWallet = wallet as unknown as {
            address?: string;
            switchChain?: unknown;
            getEthereumProvider?: unknown;
          };
          const hasSignerFns =
            typeof maybeWallet.switchChain === "function" &&
            typeof maybeWallet.getEthereumProvider === "function";
          const hasEvmAddress =
            typeof maybeWallet.address === "string" &&
            maybeWallet.address.toLowerCase().startsWith("0x");
          return hasSignerFns && hasEvmAddress;
        });
      if (!ethereumWallet) {
        const connectedTypes = wallets
          .map((wallet) => {
            const maybeWallet = wallet as unknown as { type?: string; chainType?: string };
            return `${maybeWallet.type ?? "unknown"}:${maybeWallet.chainType ?? "unknown"}`;
          })
          .join(", ");
        throw new Error(
          `No usable Ethereum wallet found in Privy. Connected wallets: ${connectedTypes || "none"}. ` +
            "Link/enable an EVM wallet and retry."
        );
      }

      const maxMembership = Number(formData.maxMembers || 0);
      if (maxMembership <= 0) throw new Error("Max members must be greater than zero.");

      const result = await createDaoOnFactory(ethereumWallet as unknown as PrivyEthereumWallet, {
        name: formData.name.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        coordinates: formData.coordinates.trim(),
        postalCode: formData.postalCode.trim(),
        maxMembership: BigInt(maxMembership),
      });

      const notices: string[] = [];
      let resolvedLogoUri = '';
      if (logoFile) {
        try {
          const uploadResult = await uploadImageToIpfs(logoFile);
          resolvedLogoUri = uploadResult.uri;
          setLogoIpfsUri(uploadResult.uri);
        } catch (logoError) {
          const message = logoError instanceof Error ? logoError.message : String(logoError ?? 'IPFS upload failed.');
          notices.push(`DAO deployed, but logo upload failed: ${message}`);
        }
      }

      if (result.daoAddress && resolvedLogoUri) {
        try {
          await updateDaoInfoOnchain(ethereumWallet as unknown as PrivyEthereumWallet, {
            daoAddress: result.daoAddress,
            description: formData.description.trim(),
            logoURI: resolvedLogoUri,
          });
        } catch (updateError) {
          const message = updateError instanceof Error ? updateError.message : String(updateError ?? 'DAO info update failed.');
          notices.push(`DAO deployed, but logo update on-chain failed: ${message}`);
        }
      }

      if (result.daoAddress) {
        try {
          await addMemberToDao(ethereumWallet as unknown as PrivyEthereumWallet, {
            daoAddress: result.daoAddress,
            memberWallet: ethereumWallet.address as `0x${string}`,
            proofReference: `system://creator-onboard/${result.daoAddress.toLowerCase()}/${Date.now()}`,
          });
        } catch (memberError) {
          const raw = memberError instanceof Error ? memberError.message : String(memberError ?? '');
          if (!raw.toLowerCase().includes('already a member')) {
            notices.push(`DAO deployed, but creator auto-onboarding failed: ${raw || 'unknown error'}`);
          }
        }
      }

      setTxHash(result.txHash);
      setCreatedDaoAddress(result.daoAddress ?? '');
      if (notices.length > 0) {
        setDeployNotice(notices.join(' '));
      }
      if (result.daoAddress && typeof window !== 'undefined') {
        sessionStorage.setItem('localdao_recent_created_dao', result.daoAddress);
      }
      setStep(5);
      localStorage.removeItem('localdao_create_progress');
    } catch (error) {
      setErrorMessage(normalizeCreateDaoError(error));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: 'Basics' },
    { id: 2, label: 'Governance' },
    { id: 3, label: 'Membership' },
    { id: 4, label: 'Review' },
    { id: 5, label: 'Deploy' },
  ];

  const focusOptions = ['Real Estate', 'Small Business', 'Solar/Green Energy', 'Community Projects'];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-12">
        <div className="flex items-center justify-between mb-4">
          {steps.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step >= s.id ? 'navy-bg text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step > s.id ? <CheckCircle className="w-5 h-5" /> : s.id}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${
                step >= s.id ? 'text-slate-900' : 'text-slate-400'
              }`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <div className="h-1 bg-slate-200 rounded-full relative">
          <div
            className="absolute h-full navy-bg rounded-full transition-all duration-500"
            style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">DAO Basics</h2>
              <p className="text-slate-500 text-sm">Let's start with the fundamental identity of your community.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">DAO Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Marina District Investments"
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-slate-700">Location</label>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={locationLoading}
                    className="text-xs font-bold text-emerald-600 hover:underline disabled:opacity-50"
                  >
                    {locationLoading ? 'Detecting...' : 'Use current location'}
                  </button>
                </div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={formData.location}
                    onChange={e => setFormData({ ...formData, location: e.target.value })}
                    placeholder="City, Neighborhood"
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
                {locationStatus && <p className="text-xs text-slate-500 mt-2">{locationStatus}</p>}
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Description</label>
                <textarea
                  rows={4}
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe your investment focus and community..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none resize-none"
                ></textarea>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">DAO Logo</label>
                <label className="w-full p-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-sm cursor-pointer flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors">
                  <Upload className="w-4 h-4 text-slate-500" />
                  <span className="text-slate-600">{logoFile ? `Selected: ${logoFile.name}` : 'Upload logo image'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (logoPreview) URL.revokeObjectURL(logoPreview);
                      setLogoFile(file);
                      setLogoIpfsUri('');
                      setLogoPreview(file ? URL.createObjectURL(file) : '');
                    }}
                  />
                </label>
                {logoPreview && (
                  <img src={logoPreview} alt="DAO logo preview" className="mt-3 w-20 h-20 rounded-xl object-cover border border-slate-200" />
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Coordinates</label>
                  <input
                    type="text"
                    value={formData.coordinates}
                    onChange={e => setFormData({ ...formData, coordinates: e.target.value })}
                    placeholder="e.g. 4.975700,8.341700"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postalCode}
                    onChange={e => setFormData({ ...formData, postalCode: e.target.value })}
                    placeholder="e.g. 540001"
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Investment Focus</label>
                <div className="flex flex-wrap gap-2">
                  {focusOptions.map(option => (
                    <button
                      key={option}
                      onClick={() => setFormData({ ...formData, focus: option })}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        formData.focus === option
                          ? 'navy-bg text-white'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Governance Rules</h2>
              <p className="text-slate-500 text-sm">Define how decisions are made in your DAO.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-3">Voting System</label>
                <div className={`p-4 rounded-xl border text-left transition-all ${
                  formData.votingSystem === 'token-weighted' ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <span className="text-sm font-bold text-slate-900">Token-weighted:</span>
                  <span className="text-xs text-slate-500 mt-1"> 1 share = 1 vote. Larger stakes have more influence.</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Proposal Threshold (%)</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.threshold}
                    onChange={e => setFormData({ ...formData, threshold: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Voting Period (Days)</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.period}
                    onChange={e => setFormData({ ...formData, period: Number(e.target.value) })}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Minimum Investment (USDC)</label>
                <input
                  type="number"
                  min={1}
                  value={formData.minInvestment}
                  onChange={e => setFormData({ ...formData, minInvestment: Number(e.target.value) })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Membership & Compliance</h2>
              <p className="text-slate-500 text-sm">Control who can participate in your neighborhood DAO.</p>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">KYC Required</p>
                    <p className="text-xs text-slate-500">Identity verification for all members</p>
                  </div>
                </div>
                <button
                  onClick={() => setFormData({ ...formData, kycRequired: !formData.kycRequired })}
                  className={`w-12 h-6 rounded-full transition-colors relative ${formData.kycRequired ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.kycRequired ? 'translate-x-7' : 'translate-x-1'}`}></div>
                </button>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Maximum Members</label>
                <input
                  type="number"
                  min={1}
                  value={formData.maxMembers}
                  onChange={e => setFormData({ ...formData, maxMembers: e.target.value })}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 mb-1">Review DAO</h2>
              <p className="text-slate-500 text-sm">One last check before deploying your neighborhood DAO.</p>
            </div>

            <div className="space-y-4 border rounded-2xl overflow-hidden divide-y">
              <div className="p-4 flex justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Basics</p>
                  <p className="text-sm font-bold">{formData.name}</p>
                  <p className="text-xs text-slate-500">{formData.location}</p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs text-emerald-600 font-bold">Edit</button>
              </div>
              <div className="p-4 flex justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Governance</p>
                  <p className="text-sm font-bold">{formData.votingSystem.replace('-', ' ')}</p>
                  <p className="text-xs text-slate-500">{formData.threshold}% threshold, {formData.period}d period</p>
                </div>
                <button onClick={() => setStep(2)} className="text-xs text-emerald-600 font-bold">Edit</button>
              </div>
              <div className="p-4 flex justify-between">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Compliance</p>
                  <p className="text-sm font-bold">{formData.kycRequired ? 'KYC Required' : 'No KYC'}</p>
                  <p className="text-xs text-slate-500">{formData.membershipType} access</p>
                </div>
                <button onClick={() => setStep(3)} className="text-xs text-emerald-600 font-bold">Edit</button>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <div className="flex justify-between items-center text-xs font-bold text-slate-500">
                <span>Network</span>
                <span>{APP_CHAIN_NAME} ({APP_CHAIN_ID})</span>
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="py-12 text-center space-y-6 animate-in zoom-in-95">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
              <CheckCircle className="w-10 h-10" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">DAO Created Successfully!</h2>
              <p className="text-slate-500 mt-2">Your neighborhood investment club is now live on {APP_CHAIN_NAME}.</p>
            </div>
            {createdDaoAddress && (
              <div className="p-4 bg-slate-50 rounded-xl font-mono text-xs text-slate-500 border border-slate-200">
                DAO: {maskAddress(createdDaoAddress)}
              </div>
            )}
            {logoIpfsUri && (
              <div className="p-4 bg-slate-50 rounded-xl font-mono text-xs text-slate-500 border border-slate-200 break-all">
                Logo URI: {logoIpfsUri}
              </div>
            )}
            {txHash && (
              <div className="p-4 bg-slate-50 rounded-xl font-mono text-xs text-slate-500 border border-slate-200">
                Tx: {maskAddress(txHash, 10, 8)}
              </div>
            )}
            {deployNotice && (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl text-xs border border-amber-200 text-left">
                {deployNotice}
              </div>
            )}
            <div className="flex gap-3 justify-center pt-4">
              {txHash ? (
                <>
                  <a
                    href={getTxExplorerUrl(txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm"
                  >
                    View on Explorer
                  </a>
                  {hasBackupExplorer() && (
                    <a
                      href={getTxExplorerUrl(txHash, 1)}
                      target="_blank"
                      rel="noreferrer"
                      className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm"
                    >
                      Backup
                    </a>
                  )}
                </>
              ) : (
                <button className="px-6 py-3 bg-white border border-slate-200 rounded-xl font-bold text-sm">Share Link</button>
              )}
              <button onClick={onComplete} className="px-6 py-3 navy-bg text-white rounded-xl font-bold text-sm">Go to Dashboard</button>
            </div>
          </div>
        )}

        {step < 5 && (
          <>
            <div className="mt-8 pt-8 border-t flex justify-between">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-colors ${
                  step === 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-50'
                }`}
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
              {step === 4 ? (
                <button
                  onClick={handleDeploy}
                  disabled={loading}
                  className="navy-bg text-white px-8 py-3 rounded-xl font-bold text-sm shadow-lg shadow-slate-900/10 flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Deploy DAO
                </button>
              ) : (
                <button
                  onClick={handleNext}
                  className="navy-bg text-white px-8 py-3 rounded-xl font-bold text-sm flex items-center gap-2"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
            {errorMessage && (
              <div className="mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                {errorMessage}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CreateDAO;
