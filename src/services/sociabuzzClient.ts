// ============================================================
//  src/services/sociabuzzClient.ts
//  Native SociaBuzz Payment Client (100% TypeScript / Vercel-ready)
// ============================================================

export interface SupportedCountry {
  country: string;
  currency: string;
  iso2: string;
}

export const SUPPORTED_COUNTRIES: Record<string, { currency: string; iso2: string }> = {
  // Southeast Asia
  Malaysia: { currency: 'MYR', iso2: 'MY' },
  Indonesia: { currency: 'IDR', iso2: 'ID' },
  Singapore: { currency: 'SGD', iso2: 'SG' },
  Philippines: { currency: 'PHP', iso2: 'PH' },
  Thailand: { currency: 'THB', iso2: 'TH' },
  // South Asia
  Pakistan: { currency: 'PKR', iso2: 'PK' },
  Bangladesh: { currency: 'BDT', iso2: 'BD' },
  'Sri Lanka': { currency: 'LKR', iso2: 'LK' },
  // Middle East
  'United Arab Emirates': { currency: 'AED', iso2: 'AE' },
  'Saudi Arabia': { currency: 'SAR', iso2: 'SA' },
  Qatar: { currency: 'QAR', iso2: 'QA' },
  // Africa
  Nigeria: { currency: 'NGN', iso2: 'NG' },
  'South Africa': { currency: 'ZAR', iso2: 'ZA' },
  // Europe
  'United Kingdom': { currency: 'GBP', iso2: 'GB' },
  Denmark: { currency: 'DKK', iso2: 'DK' },
  // Oceania
  Australia: { currency: 'AUD', iso2: 'AU' },
  'New Zealand': { currency: 'NZD', iso2: 'NZ' },
  // Americas
  'United States': { currency: 'USD', iso2: 'US' },
};

/**
 * Label tampilan untuk group channel pembayaran (port dari constants.go scbz).
 */
export const GROUP_LABELS: Record<string, string> = {
  ewallet: 'E-Wallet',
  ewallet_id: 'E-Wallet',
  ewallet_all: 'E-Wallet',
  qris: 'QRIS',
  bank_transfer: 'Bank Transfer',
  bank_transfer_inter: 'Bank Transfer',
  direct_debit: 'Direct Debit',
  bank_redirect: 'Bank Redirect',
  retail_outlet: 'Retail Outlet',
  retail_outlet_ph: 'Retail Outlet',
  credit_card: 'Card',
  credit_card_stripe: 'Card',
  crypto: 'Crypto',
};

export const groupLabel = (rawGroup: string): string =>
  GROUP_LABELS[rawGroup] || rawGroup;

const COMMON_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Ch-Ua': '"Chromium";v="130", "Not?A_Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"Windows"',
};

export class CookieJar {
  private cookies = new Map<string, string>();

  public updateFromHeaders(headers: Headers): void {
    const rawCookies: string[] = [];
    if (typeof (headers as any).getSetCookie === 'function') {
      rawCookies.push(...(headers as any).getSetCookie());
    } else {
      const single = headers.get('set-cookie');
      if (single) rawCookies.push(single);
    }

    for (const raw of rawCookies) {
      if (!raw) continue;
      const part = raw.split(';')[0];
      const eqIdx = part.indexOf('=');
      if (eqIdx > 0) {
        const name = part.substring(0, eqIdx).trim();
        const value = part.substring(eqIdx + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  public getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  public get(name: string): string | undefined {
    return this.cookies.get(name);
  }

  public getCsrf(): string {
    return this.cookies.get('sociabuzz_sb_cookie_csrf') || this.cookies.get('csrf_cookie_name') || '';
  }
}

export interface FeeEstimate {
  id: number;
  name: string;
  label: string;
  group: string;
  gateway: string;
  currency: string;
  amount: number;
  fee: {
    fee_type: string;
    fee_rate: string;
    total_fee: number;
    total_pay: number;
  };
}

export class SociabuzzClient {
  private baseURL = 'https://sociabuzz.com';

  /**
   * 1. Inisialisasi sesi & ambil CSRF Token dari halaman creator
   */
  async initSession(username: string, jar: CookieJar): Promise<string> {
    const res = await fetch(`${this.baseURL}/${encodeURIComponent(username)}/tribe`, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      },
      signal: AbortSignal.timeout(20000),
    });

    jar.updateFromHeaders(res.headers);

    if (!res.ok) {
      throw new Error(`Gagal membuka profil SociaBuzz '${username}' (HTTP ${res.status}). Pastikan username akun SociaBuzz valid.`);
    }

    return jar.getCsrf();
  }

  /**
   * 2. Buat sesi donasi / pembayaran untuk mendapatkan payment token
   */
  async submitDonation(
    username: string,
    amount: number,
    fullname: string,
    email: string,
    note: string,
    jar: CookieJar,
    country = 'Indonesia'
  ): Promise<{ token: string; actualAmount: number; redirectUrl: string }> {
    let csrfToken = jar.getCsrf();
    if (!csrfToken) {
      csrfToken = await this.initSession(username, jar);
    }

    const countryInfo = SUPPORTED_COUNTRIES[country] || SUPPORTED_COUNTRIES['Indonesia'];
    const currency = countryInfo.currency;

    const form = new URLSearchParams();
    form.set('sb_token_csrf', csrfToken);
    form.set('currency', currency);
    form.set('amount', Math.round(amount).toString());
    form.set('price', Math.round(amount).toString());
    form.set('unit_price', Math.round(amount).toString());
    form.set('qty', '1');
    form.set('support_duration', '30');
    form.set('note', note.slice(0, 255));
    form.set('fullname', fullname.slice(0, 100));
    form.set('email', email);
    form.set('is_agree', '1');
    form.set('years18', '1');
    form.set('is_vote', '0');
    form.set('is_voice', '0');
    form.set('is_mediashare', '0');
    form.set('is_gif', '0');
    form.set('is_sound', '0');
    form.set('vote_id', '');
    form.set('ms_maxtime', '');
    form.set('start_from', '0');
    form.set('ms_starthour', '0');
    form.set('ms_startminute', '0');
    form.set('ms_startsecond', '0');
    form.set('spin_check', '0');
    form.set('prev_url', `${this.baseURL}/${encodeURIComponent(username)}/tribe?`);
    form.set('hide_email', '0');
    form.set('is_tiktok', '0');
    form.set('tiktok_duration', '0');
    form.set('is_instagram', '0');
    form.set('instagram_duration', '0');
    form.set('wishlist_id', '');
    form.set('quickpay', '0');
    form.set('redirect_cancel', `${this.baseURL}/${encodeURIComponent(username)}/tribe?`);

    const res = await fetch(`${this.baseURL}/${encodeURIComponent(username)}/donate/get-form-queue`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: this.baseURL,
        Referer: `${this.baseURL}/${encodeURIComponent(username)}/tribe?`,
        Cookie: jar.getCookieHeader(),
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
      body: form.toString(),
      signal: AbortSignal.timeout(25000),
    });

    jar.updateFromHeaders(res.headers);

    const rawText = (await res.text()).trim();
    let json: any = {};
    try {
      json = JSON.parse(rawText);
    } catch (_) {}
    if (!res.ok || json.success === false) {
      const errMsg = json.message || json.error || `SociaBuzz menolak donasi (HTTP ${res.status})`;
      throw new Error(errMsg);
    }

    const redirect = json.content?.redirect || '';
    let token = '';
    if (redirect) {
      const parts = redirect.replace(/\/+$/, '').split('/');
      token = parts[parts.length - 1];
    }

    if (!token) {
      throw new Error('SociaBuzz tidak mengembalikan token pembayaran.');
    }

    return {
      token,
      actualAmount: amount,
      redirectUrl: redirect,
    };
  }

  /**
   * 3. Ambil pengaturan channel pembayaran & CSRF pembayaran
   */
  async visitPaymentPage(token: string, jar: CookieJar): Promise<string> {
    const res = await fetch(`${this.baseURL}/payment/x/${token}`, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        Cookie: jar.getCookieHeader(),
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Dest': 'document',
      },
      signal: AbortSignal.timeout(20000),
    });

    jar.updateFromHeaders(res.headers);
    const html = await res.text();

    const m = html.match(/name=["']sb_token_csrf["']\s+value=["']([^"']*)["']/i);
    if (m && m[1]) {
      return m[1];
    }

    return jar.getCsrf();
  }

  /**
   * 4. Ambil metode pembayaran yang aktif
   */
  async getPaymentSettings(
    token: string,
    amount: number,
    country = 'Indonesia',
    jar: CookieJar
  ): Promise<any> {
    const countryInfo = SUPPORTED_COUNTRIES[country] || SUPPORTED_COUNTRIES['Indonesia'];
    const currency = countryInfo.currency;

    const q = new URLSearchParams({
      amount: Math.round(amount).toString(),
      currency,
      base_amount: Math.round(amount).toString(),
      base_currency: currency,
      currency_def: currency,
      convertion: currency,
      country,
      feature: 'TRIBE',
      is_borne_fee: '1',
      risk: '',
      message: '',
      direct: '',
      service_fee: '0',
      token,
      country_account: '',
    });

    const res = await fetch(`${this.baseURL}/payment/pay/setting?${q.toString()}`, {
      method: 'GET',
      headers: {
        ...COMMON_HEADERS,
        Accept: 'application/json, text/plain, */*',
        Referer: `${this.baseURL}/payment/x/${token}`,
        Cookie: jar.getCookieHeader(),
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
      signal: AbortSignal.timeout(20000),
    });

    jar.updateFromHeaders(res.headers);
    return await res.json();
  }

  /**
   * 5. Buat tagihan pembayaran (Generate QRIS / Payment Link)
   */
  async createPayment(
    token: string,
    paymentMethod: string,
    amount: number,
    country = 'Indonesia',
    jar: CookieJar
  ): Promise<any> {
    const pageCsrf = await this.visitPaymentPage(token, jar);
    const settings = await this.getPaymentSettings(token, amount, country, jar);

    const targetMethod = paymentMethod.trim().toLowerCase();
    let selectedMethod: any = null;
    let selectedGroup = '';

    for (const group of settings.payment_channel || []) {
      for (const m of group.available || []) {
        if (!m.active) continue;
        const name = (m.name || '').toLowerCase();
        const alias = (m.alias || '').toLowerCase();
        const groupName = (group.name || '').toLowerCase();

        if (
          name === targetMethod ||
          alias === targetMethod ||
          (targetMethod === 'qris' && (name.includes('qris') || groupName === 'qris')) ||
          (targetMethod === 'ewallet' && (groupName.includes('ewallet') || ['gopay', 'ovo', 'dana', 'shopeepay'].includes(name))) ||
          (targetMethod === 'va' && (groupName.includes('bank_transfer') || name.includes('va')))
        ) {
          selectedMethod = m;
          selectedGroup = group.name;
          break;
        }
      }
      if (selectedMethod) break;
    }

    if (!selectedMethod) {
      throw new Error(`Metode pembayaran "${paymentMethod}" tidak tersedia saat ini untuk sesi ini.`);
    }

    const countryInfo = SUPPORTED_COUNTRIES[country] || SUPPORTED_COUNTRIES['Indonesia'];
    const currency = targetMethod === 'qris' ? 'IDR' : countryInfo.currency;

    const payload = {
      sb_token_csrf: pageCsrf || jar.getCsrf(),
      order_id: token,
      final_currency: currency,
      currency_def: currency,
      payment_method: selectedMethod.name,
      type_payment: selectedGroup,
      source_payment: selectedMethod.source || selectedMethod.source_payment || 'oy',
      country: countryInfo.iso2,
      country_pay: country,
    };

    const res = await fetch(`${this.baseURL}/payment/send/create`, {
      method: 'POST',
      headers: {
        ...COMMON_HEADERS,
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        Origin: this.baseURL,
        Referer: `${this.baseURL}/payment/x/${token}`,
        Cookie: jar.getCookieHeader(),
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000),
    });

    jar.updateFromHeaders(res.headers);
    const json: any = await res.json().catch(() => ({}));

    if (!res.ok || json.success === false) {
      throw new Error(json.message || json.error || `Gagal membuat tagihan pembayaran (HTTP ${res.status})`);
    }

    const data = json.data || {};
    const paymentUrl = data.payment_link || data.redirect_url || null;
    const qrString = data.qr_string || null;
    const invId = json.inv_id || data.id || data.inv_id || token;

    const channelFee = Number(selectedMethod.total_fee || selectedMethod.fee || 0);
    // Nominal yang DIBEBANKAN ke pembayar di QR = nilai donasi + fee channel
    // (is_borne_fee). Terverifikasi berulang: tag 54 di dalam QR SELALU
    // sama dengan amount + fee (field total_pay milik settings TIDAK
    // mencantumkan fee borne), jadi dihitung eksplisit tanpa syarat.
    const gatewayTotalPay = amount + channelFee;

    return {
      success: true,
      token,
      inv_id: invId,
      payment_method: selectedMethod.name,
      label: selectedMethod.alias || selectedMethod.name,
      payment_url: paymentUrl,
      qr_string: qrString,
      fee: {
        total_fee: channelFee,
        total_pay: gatewayTotalPay,
      },
      payment_status: 'pending',
    };
  }

  /**
   * 6. Cek Status Pembayaran ke SociaBuzz
   *
   * PENTING: deteksi 'paid' HANYA lewat redirect URL ke /payment/success.
   * Penyaringan teks HTML (mis. "pembayaran berhasil") TERBUKTI salah —
   * frasa tersebut juga muncul di halaman yang BELUM dibayar (teks
   * instruksi), sehingga pesanan bisa tercatat lunas tanpa pembayaran.
   */
  async checkPaymentStatus(
    token: string,
    paymentMethod: string,
    invId?: string
  ): Promise<'paid' | 'pending' | 'expired' | 'failed'> {
    // Jalur 1: halaman token sesi — ikuti redirect; lunas bila diarahkan
    // ke halaman success.
    try {
      const resToken = await fetch(`${this.baseURL}/payment/x/${token}`, {
        method: 'GET',
        headers: {
          ...COMMON_HEADERS,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      if (resToken.url.includes('/payment/success')) {
        return 'paid';
      }
    } catch (_) {}

    // Jalur 2: endpoint status pending — lunas bila redirect ke success;
    // expired bila halaman menyatakan kedaluwarsa secara eksplisit.
    try {
      const targetInvId = invId || token;
      const q = new URLSearchParams({
        type: paymentMethod || 'qris',
        inv_id: targetInvId,
      });

      const res = await fetch(`${this.baseURL}/payment/pending?${q.toString()}`, {
        method: 'GET',
        headers: {
          ...COMMON_HEADERS,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          Referer: `${this.baseURL}/payment/x/${token}`,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10000),
      });

      if (res.url.includes('/payment/success')) {
        return 'paid';
      }

      if (res.ok) {
        const html = (await res.text()).toLowerCase();
        if (
          html.includes('payment expired') ||
          html.includes('kadaluarsa') ||
          html.includes('kedaluwarsa')
        ) {
          return 'expired';
        }
      }
    } catch (_) {}

    return 'pending';
  }

  /**
   * 7. Estimasi fee LIVE per metode pembayaran (port FeeCalculator dari scbz Go).
   * Membuka sesi donasi sementara (tidak pernah dibayar, otomatis kadaluarsa)
   * lalu membaca tabel fee nyata dari SociaBuzz untuk negara + nominal terkait.
   */
  async estimateFees(
    country: string,
    amount: number,
    username: string,
    jar: CookieJar
  ): Promise<FeeEstimate[]> {
    const countryInfo = SUPPORTED_COUNTRIES[country];
    if (!countryInfo) {
      throw new Error(`Negara "${country}" tidak didukung. Gunakan salah satu dari: ${Object.keys(SUPPORTED_COUNTRIES).join(', ')}`);
    }
    const currency = countryInfo.currency;

    // Sesi sementara — nama/email dummy agar tidak mengganggu data pelanggan.
    const donation = await this.submitDonation(
      username,
      amount,
      'Fee Estimate',
      'noreply@dinoyocraft.local',
      'fee-estimate',
      jar,
      country
    );

    await this.visitPaymentPage(donation.token, jar);
    const settings = await this.getPaymentSettings(donation.token, amount, country, jar);

    const estimates: FeeEstimate[] = [];
    let counter = 0;
    for (const group of settings.payment_channel || []) {
      for (const m of group.available || []) {
        if (!m.active) continue;
        counter++;
        const totalFee = Number(m.total_fee ?? m.fee ?? 0);
        const totalPay = Number(m.total_pay ?? amount + totalFee);
        const feeRate =
          amount > 0 && totalFee > 0
            ? `${((totalFee / amount) * 100).toFixed(2)}%`
            : 'flat';
        estimates.push({
          id: counter,
          name: m.name,
          label: m.alias || m.name,
          group: groupLabel(group.name),
          gateway: m.source || m.source_payment || 'oy',
          currency,
          amount,
          fee: {
            fee_type: feeRate === 'flat' ? 'fixed' : 'percent',
            fee_rate: feeRate,
            total_fee: totalFee,
            total_pay: totalPay,
          },
        });
      }
    }
    return estimates;
  }
}

export const sociabuzzClient = new SociabuzzClient();
export default sociabuzzClient;

