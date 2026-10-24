/**
 * OUI Vendor Catalog for MAC Address Hardware Identification
 */
const MAC_VENDORS = {
  // Mobile & Consumer Electronics
  '7c:7b:1c': { vendor: 'Apple Inc.', type: 'mobile' },
  'bc:54:2f': { vendor: 'Apple Inc.', type: 'mobile' },
  '48:f1:7f': { vendor: 'Apple Inc.', type: 'mobile' },
  'a4:55:90': { vendor: 'Apple Inc.', type: 'mobile' },
  '70:b7:aa': { vendor: 'Apple Inc.', type: 'mobile' },
  '80:79:5d': { vendor: 'Samsung Electronics', type: 'mobile' },
  'dc:fb:48': { vendor: 'Samsung Electronics', type: 'mobile' },
  'b0:19:21': { vendor: 'Xiaomi Communications', type: 'mobile' },
  'ea:73:67': { vendor: 'Xiaomi Communications', type: 'mobile' },
  '50:98:39': { vendor: 'Huawei Technologies', type: 'mobile' },
  '84:fd:d1': { vendor: 'Huawei Technologies', type: 'mobile' },

  // Routers & Networking
  'dc:2c:6e': { vendor: 'Huawei Technologies', type: 'router' },
  'd0:05:e4': { vendor: 'TP-Link Corporation', type: 'router' },
  '00:1a:2b': { vendor: 'Cisco Systems', type: 'router' },
  'c4:6e:1f': { vendor: 'TP-Link Corporation', type: 'router' },
  '50:d4:f7': { vendor: 'TP-Link Corporation', type: 'router' },

  // Workstations & NICs
  'dc:41:a9': { vendor: 'Realtek Semiconductor', type: 'workstation' },
  '44:e5:17': { vendor: 'Intel Corporate', type: 'workstation' },
  '00:1e:c9': { vendor: 'Dell Inc.', type: 'workstation' },
  'f0:4d:a2': { vendor: 'HP Inc.', type: 'workstation' },
  '2c:db:07': { vendor: 'Intel Corporation', type: 'workstation' },

  // IoT & Embedded
  '24:0a:c4': { vendor: 'Espressif IoT', type: 'other' },
  '30:ae:a4': { vendor: 'Espressif IoT', type: 'other' },
  '84:0d:8e': { vendor: 'Espressif IoT', type: 'other' },
  'b8:27:eb': { vendor: 'Raspberry Pi', type: 'server' },
  'dc:a6:32': { vendor: 'Raspberry Pi', type: 'server' },
  'e4:5f:01': { vendor: 'Raspberry Pi', type: 'server' }
};

export function lookupVendor(macAddress) {
  if (!macAddress) return { vendor: 'Network Host', type: 'other' };

  const clean = macAddress.toLowerCase().replace(/[:-]/g, ':');
  const prefix = clean.slice(0, 8); // e.g. "dc:41:a9"

  if (MAC_VENDORS[prefix]) {
    return MAC_VENDORS[prefix];
  }

  // Check if MAC has IEEE 802 randomized bit set (Private Wi-Fi on Android / iOS)
  try {
    const firstByte = parseInt(clean.split(':')[0], 16);
    if (!isNaN(firstByte) && (firstByte & 0x02)) {
      return { vendor: 'Mobile Device (Private Wi-Fi)', type: 'mobile' };
    }
  } catch (e) {
    // ignore
  }

  return { vendor: 'LAN Device', type: 'workstation' };
}

export default { lookupVendor };
