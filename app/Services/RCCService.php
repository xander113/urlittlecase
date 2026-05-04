<?php

namespace App\Services;

use App\Models\Avatar;
use App\Models\Item;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * RCCService — PHP client for the Python 3D rendering microservice.
 *
 * Thumbnail types (matching Roblox Avatar Rendering API):
 *   full_body  Full character, feet to hat
 *   headshot   Head and shoulders crop
 *   bust       Waist and up
 *
 * Sizes: 48, 60, 75, 100, 110, 150, 180, 352, 420, 720
 */
class RCCService
{
    private string $baseUrl;
    private int    $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('RCC_SERVICE_URL', 'http://127.0.0.1:2089'), '/');
        $this->timeout = (int) env('RCC_TIMEOUT', 20);
    }

    /* ── Primary render methods ───────────────────────────────────────────── */

    /**
     * Render an avatar full-body thumbnail from colour data.
     * Called by AvatarController::regenerateThumbnail() (the live preview endpoint).
     */
    public function renderAvatarFromColors(
        string  $bodyColor,
        array   $slotColors,
        int     $userId,
        string  $thumbnailType = 'full_body',
        int     $size          = 420,
        float   $yRotDeg       = 0.0,
        float   $distanceScale = 1.0,
        ?string $bgColor       = null,
    ): ?string {
        $clean = array_filter($slotColors, fn ($s) => is_array($s) && !empty($s['primary']));

        try {
            if (!$this->isAlive()) {
                return $this->fallbackAvatarUrl($userId);
            }

            $response = Http::timeout($this->timeout)->post("{$this->baseUrl}/render/avatar", [
                'body_color'     => $bodyColor,
                'slot_colors'    => $clean,
                'thumbnail_type' => $thumbnailType,
                'size'           => $size,
                'y_rot_deg'      => $yRotDeg,
                'distance_scale' => $distanceScale,
                'bg_color'       => $bgColor,
                'user_id'        => $userId,
                'save'           => true,
            ]);

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }

            Log::warning('RCCService::renderAvatarFromColors non-200', [
                'status'       => $response->status(),
                'body_preview' => substr($response->body(), 0, 200),
            ]);
        } catch (Throwable $e) {
            Log::error('RCCService::renderAvatarFromColors', ['error' => $e->getMessage()]);
        }

        return $this->fallbackAvatarUrl($userId);
    }

    /**
     * Render headshot only — tight crop around head and shoulders.
     * Used for profile thumbnails, nav bar avatar, user lists.
     */
    public function renderHeadshot(
        string $bodyColor,
        array  $slotColors,
        int    $userId,
        int    $size = 420,
    ): ?string {
        return $this->renderAvatarFromColors($bodyColor, $slotColors, $userId, 'headshot', $size);
    }

    /**
     * Render bust (waist-up) thumbnail.
     */
    public function renderBust(
        string $bodyColor,
        array  $slotColors,
        int    $userId,
        int    $size = 420,
    ): ?string {
        return $this->renderAvatarFromColors($bodyColor, $slotColors, $userId, 'bust', $size);
    }

    /**
     * Full pipeline: Python RCC fetches avatar config from DB itself, renders, saves.
     * Used by the GenerateThumbnail job (post-save async render).
     */
    public function renderAvatarForUser(
        int    $userId,
        string $thumbnailType = 'full_body',
        int    $size          = 420,
    ): ?string {
        try {
            if (!$this->isAlive()) {
                return null;
            }

            $response = Http::timeout($this->timeout)->get(
                "{$this->baseUrl}/render/avatar/{$userId}",
                ['type' => $thumbnailType, 'size' => $size]
            );

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }
        } catch (Throwable $e) {
            Log::error('RCCService::renderAvatarForUser', ['uid' => $userId, 'error' => $e->getMessage()]);
        }

        return null;
    }

    /**
     * Render an Avatar model (with all its relationship data).
     * Builds slot colors from the avatar's equipped user_items.
     */
    public function renderAvatar(
        Avatar $avatar,
        string $thumbnailType = 'full_body',
        int    $size          = 420,
    ): ?string {
        $slotColors = $this->buildSlotColors($avatar);

        return $this->renderAvatarFromColors(
            $avatar->body_color ?? '#D9D9D9',
            $slotColors,
            $avatar->user_id,
            $thumbnailType,
            $size,
        );
    }

    /**
     * Render an item thumbnail.
     */
    public function renderItem(Item $item, int $size = 420): ?string
    {
        try {
            if (!$this->isAlive()) {
                return $this->fallbackItemGd($item);
            }

            $response = Http::timeout($this->timeout)->post("{$this->baseUrl}/render/item", [
                'color_primary'   => $item->color_primary   ?? '#6366f1',
                'color_secondary' => $item->color_secondary ?? '#4338ca',
                'category'        => $item->category,
                'item_id'         => $item->id,
                'size'            => $size,
                'save'            => true,
            ]);

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }
        } catch (Throwable $e) {
            Log::error('RCCService::renderItem', ['item_id' => $item->id, 'error' => $e->getMessage()]);
        }

        return $this->fallbackItemGd($item);
    }

    /* ── Supported types/sizes query ──────────────────────────────────────── */

    /**
     * Return the list of thumbnail types and sizes the Python service supports.
     */
    public function getSupportedTypes(): array
    {
        try {
            $res = Http::timeout(5)->get("{$this->baseUrl}/thumbnail/types");
            if ($res->successful()) return $res->json();
        } catch (Throwable) {}

        return [
            'types'    => ['full_body', 'headshot', 'bust'],
            'sizes'    => [48, 60, 75, 100, 110, 150, 180, 352, 420, 720],
            'renderer' => 'unknown',
        ];
    }

    /* ── WSDL ─────────────────────────────────────────────────────────────── */

    public function wsdl(string $serviceUrl): string
    {
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<definitions name="YLCRCCService" targetNamespace="urn:YLCRCCService"
    xmlns="http://schemas.xmlsoap.org/wsdl/"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:tns="urn:YLCRCCService"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <types>
    <xsd:schema targetNamespace="urn:YLCRCCService">
      <xsd:element name="RenderAvatarRequest">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="user_id"        type="xsd:integer"/>
          <xsd:element name="body_color"     type="xsd:string"/>
          <xsd:element name="thumbnail_type" type="xsd:string" minOccurs="0"/>
          <xsd:element name="size"           type="xsd:integer" minOccurs="0"/>
          <xsd:element name="y_rot_deg"      type="xsd:float"   minOccurs="0"/>
          <xsd:element name="distance_scale" type="xsd:float"   minOccurs="0"/>
          <xsd:element name="bg_color"       type="xsd:string"  minOccurs="0"/>
          <xsd:element name="hat_primary"    type="xsd:string"  minOccurs="0"/>
          <xsd:element name="hat_secondary"  type="xsd:string"  minOccurs="0"/>
          <xsd:element name="face_primary"   type="xsd:string"  minOccurs="0"/>
          <xsd:element name="shirt_primary"  type="xsd:string"  minOccurs="0"/>
          <xsd:element name="pants_primary"  type="xsd:string"  minOccurs="0"/>
          <xsd:element name="shoes_primary"  type="xsd:string"  minOccurs="0"/>
          <xsd:element name="acc_primary"    type="xsd:string"  minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderAvatarResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="thumbnail_url"  type="xsd:string"/>
          <xsd:element name="thumbnail_type" type="xsd:string"/>
          <xsd:element name="size"           type="xsd:integer"/>
          <xsd:element name="renderer"       type="xsd:string"/>
          <xsd:element name="success"        type="xsd:boolean"/>
          <xsd:element name="error"          type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemRequest">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="item_id"          type="xsd:integer"/>
          <xsd:element name="color_primary"    type="xsd:string"/>
          <xsd:element name="color_secondary"  type="xsd:string"/>
          <xsd:element name="category"         type="xsd:string"/>
          <xsd:element name="size"             type="xsd:integer" minOccurs="0"/>
          <xsd:element name="bg_color"         type="xsd:string"  minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="thumbnail_url"  type="xsd:string"/>
          <xsd:element name="renderer"       type="xsd:string"/>
          <xsd:element name="success"        type="xsd:boolean"/>
          <xsd:element name="error"          type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>
  <message name="RenderAvatarIn"><part name="parameters" element="tns:RenderAvatarRequest"/></message>
  <message name="RenderAvatarOut"><part name="parameters" element="tns:RenderAvatarResponse"/></message>
  <message name="RenderItemIn"><part name="parameters" element="tns:RenderItemRequest"/></message>
  <message name="RenderItemOut"><part name="parameters" element="tns:RenderItemResponse"/></message>
  <portType name="YLCRCCPortType">
    <operation name="RenderAvatar">
      <input message="tns:RenderAvatarIn"/><output message="tns:RenderAvatarOut"/>
    </operation>
    <operation name="RenderItem">
      <input message="tns:RenderItemIn"/><output message="tns:RenderItemOut"/>
    </operation>
  </portType>
  <binding name="YLCRCCBinding" type="tns:YLCRCCPortType">
    <soap:binding style="document" transport="http://schemas.xmlsoap.org/soap/http"/>
    <operation name="RenderAvatar">
      <soap:operation soapAction="urn:RenderAvatar"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
    <operation name="RenderItem">
      <soap:operation soapAction="urn:RenderItem"/>
      <input><soap:body use="literal"/></input>
      <output><soap:body use="literal"/></output>
    </operation>
  </binding>
  <service name="YLCRCCService">
    <port name="YLCRCCPort" binding="tns:YLCRCCBinding">
      <soap:address location="{$serviceUrl}"/>
    </port>
  </service>
</definitions>
XML;
    }

    /* ── SOAP handler ─────────────────────────────────────────────────────── */

    public function handleSoapRequest(string $rawBody): string
    {
        if (empty(trim($rawBody))) {
            return $this->soapFault('Client', 'Empty request body');
        }

        try {
            libxml_use_internal_errors(true);
            libxml_clear_errors();

            $dom = new \DOMDocument('1.0', 'UTF-8');
            $dom->recover = true;
            $loaded = $dom->loadXML($rawBody, LIBXML_NOCDATA | LIBXML_NONET);

            if (!$loaded) {
                $errs = array_map(fn ($e) => trim($e->message), libxml_get_errors());
                libxml_clear_errors();
                Log::warning('RCCService SOAP parse error', ['errors' => $errs, 'preview' => substr($rawBody, 0, 300)]);
                return $this->soapFault('Client', 'XML parse error: ' . implode('; ', array_slice($errs, 0, 2)));
            }
            libxml_clear_errors();

            $xpath = new \DOMXPath($dom);
            $xpath->registerNamespace('soap', 'http://schemas.xmlsoap.org/soap/envelope/');

            $bodyChildren = $xpath->query('//soap:Body/*');
            if (!$bodyChildren || $bodyChildren->length === 0) {
                return $this->soapFault('Client', 'Missing or empty SOAP Body');
            }

            $opNode = $bodyChildren->item(0);
            $opName = $opNode->localName ?? '';

            return match (true) {
                str_contains($opName, 'RenderAvatar') => $this->soapRenderAvatar($xpath, $opNode),
                str_contains($opName, 'RenderItem')   => $this->soapRenderItem($xpath, $opNode),
                default => $this->soapFault('Client', "Unknown operation: {$opName}"),
            };
        } catch (Throwable $e) {
            Log::error('RCCService::handleSoapRequest', ['error' => $e->getMessage()]);
            return $this->soapFault('Server', 'Internal server error');
        }
    }

    /* ── Private helpers ──────────────────────────────────────────────────── */

    private function soapRenderAvatar(\DOMXPath $xpath, \DOMNode $opNode): string
    {
        $get = fn (string $tag) => $xpath->query(".//*[local-name()='{$tag}']", $opNode)->item(0)?->textContent ?? '';

        $userId       = (int)   ($get('user_id')        ?: 0);
        $bodyColor    = $get('body_color')  ?: '#D9D9D9';
        $thumbType    = $get('thumbnail_type') ?: 'full_body';
        $size         = (int)   ($get('size')           ?: 420);
        $yRot         = (float) ($get('y_rot_deg')      ?: 0);
        $dScale       = (float) ($get('distance_scale') ?: 1.0);
        $bgColor      = $get('bg_color') ?: null;

        $slotColors = [];
        foreach (['hat', 'face', 'shirt', 'pants', 'shoes'] as $slot) {
            $p = $get("{$slot}_primary");
            if ($p) $slotColors[$slot] = ['primary' => $p, 'secondary' => $get("{$slot}_secondary") ?: null];
        }
        $acc = $get('acc_primary');
        if ($acc) $slotColors['accessory'] = ['primary' => $acc];

        $url      = $this->renderAvatarFromColors($bodyColor, $slotColors, $userId, $thumbType, $size, $yRot, $dScale, $bgColor);
        $success  = !empty($url);
        $renderer = $this->isAlive() ? '3D' : 'fallback';

        return $this->soapResponse('RenderAvatarResponse', [
            'thumbnail_url'  => $url ?? '',
            'thumbnail_type' => $thumbType,
            'size'           => (string) $size,
            'renderer'       => $renderer,
            'success'        => $success ? 'true' : 'false',
            'error'          => $success ? '' : 'Render failed',
        ]);
    }

    private function soapRenderItem(\DOMXPath $xpath, \DOMNode $opNode): string
    {
        $get = fn (string $tag) => $xpath->query(".//*[local-name()='{$tag}']", $opNode)->item(0)?->textContent ?? '';

        $itemId = (int) ($get('item_id') ?: 0);
        $item   = Item::find($itemId);

        if (!$item) {
            return $this->soapFault('Client', "Item #{$itemId} not found");
        }

        $size = (int) ($get('size') ?: 420);
        $url  = $this->renderItem($item, $size);

        return $this->soapResponse('RenderItemResponse', [
            'thumbnail_url' => $url ?? '',
            'renderer'      => $this->isAlive() ? '3D' : 'fallback',
            'success'       => !empty($url) ? 'true' : 'false',
            'error'         => empty($url) ? 'Render failed' : '',
        ]);
    }

    private function buildSlotColors(Avatar $avatar): array
    {
        $out = [];
        $map = [
            'hat'       => $avatar->hat_user_item_id,
            'face'      => $avatar->face_user_item_id,
            'shirt'     => $avatar->shirt_user_item_id,
            'pants'     => $avatar->pants_user_item_id,
            'shoes'     => $avatar->shoes_user_item_id,
            'accessory' => $avatar->accessory_user_item_id,
        ];

        foreach ($map as $slot => $userItemId) {
            if (!$userItemId) continue;
            $ui = \App\Models\UserItem::with('item:id,color_primary,color_secondary')->find($userItemId);
            if ($ui?->item) {
                $out[$slot] = [
                    'primary'   => $ui->item->color_primary   ?? '#888888',
                    'secondary' => $ui->item->color_secondary ?? '#666666',
                ];
            }
        }

        return $out;
    }

    private function isAlive(): bool
    {
        try {
            return Http::timeout(3)->get("{$this->baseUrl}/health")->successful();
        } catch (Throwable) {
            return false;
        }
    }

    private function fallbackAvatarUrl(int $userId): ?string
    {
        try {
            $avatar = Avatar::where('user_id', $userId)->first();
            if (!$avatar) return null;
            return app(ThumbnailService::class)->generateAvatarThumbnail($avatar);
        } catch (Throwable $e) {
            Log::error('RCCService fallbackAvatarUrl', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function fallbackItemGd(Item $item): ?string
    {
        try {
            return app(ThumbnailService::class)->generateItemThumbnail($item);
        } catch (Throwable $e) {
            Log::error('RCCService fallbackItemGd', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function soapResponse(string $op, array $fields): string
    {
        $inner = '';
        foreach ($fields as $k => $v) {
            $inner .= '<tns:' . $k . '>' . htmlspecialchars((string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</tns:' . $k . '>';
        }
        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:YLCRCCService">'
            . '<soap:Body><tns:' . $op . '>' . $inner . '</tns:' . $op . '></soap:Body>'
            . '</soap:Envelope>';
    }

    private function soapFault(string $code, string $message): string
    {
        $safe = htmlspecialchars($message, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
            . '<soap:Body><soap:Fault><faultcode>' . $code . '</faultcode><faultstring>' . $safe . '</faultstring></soap:Fault></soap:Body>'
            . '</soap:Envelope>';
    }
}
