<?php

namespace App\Services;

use App\Models\Avatar;
use App\Models\Item;
use App\Models\UserItem;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * RCCService — delegates thumbnail rendering to the Python RCC microservice.
 *
 * Browser-facing flow (correct architecture — like Roblox):
 *   Browser → POST /avatar/thumbnail (JSON, axios, CSRF-safe)
 *             → AvatarController::regenerateThumbnail()
 *             → RCCService::renderAvatarFromColors()   ← this class
 *             → Python RCC service (HTTP REST)
 *             → PNG saved to storage, URL returned
 *
 * The browser NEVER calls /rcc/soap directly.
 * /rcc/soap is a server-to-server SOAP endpoint for legacy compatibility only.
 */
class RCCService
{
    private string $baseUrl;
    private int    $timeout;

    public function __construct()
    {
        $this->baseUrl = rtrim(env('RCC_SERVICE_URL', 'http://127.0.0.1:2089'), '/');
        $this->timeout = (int) env('RCC_TIMEOUT', 15);
    }

    /* ── Primary REST-based entry points ──────────────────────────────────── */

    /**
     * Render an avatar thumbnail from raw color data (JSON → Python REST).
     * Used by AvatarController::regenerateThumbnail().
     */
    public function renderAvatarFromColors(string $bodyColor, array $slotColors, int $userId): ?string
    {
        // Sanitise slot colors — remove any null/empty slots
        $clean = array_filter($slotColors, fn ($s) => is_array($s) && !empty($s['primary']));

        try {
            if (!$this->isAlive()) {
                return $this->fallbackAvatarUrl($userId);
            }

            $response = Http::timeout($this->timeout)->post("{$this->baseUrl}/render/avatar", [
                'body_color'  => $bodyColor,
                'slot_colors' => $clean,
                'user_id'     => $userId,
                'save'        => true,
            ]);

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }

            Log::warning('RCCService::renderAvatarFromColors non-200', [
                'status' => $response->status(),
                'body'   => substr($response->body(), 0, 200),
            ]);
        } catch (Throwable $e) {
            Log::error('RCCService::renderAvatarFromColors', ['error' => $e->getMessage()]);
        }

        return $this->fallbackAvatarUrl($userId);
    }

    /**
     * Render an avatar thumbnail from a saved Avatar model (pulls colors from relationships).
     * Used by the GenerateThumbnail job.
     */
    public function renderAvatar(Avatar $avatar, ?int $userId = null): ?string
    {
        try {
            if (!$this->isAlive()) {
                return $this->fallbackGd($avatar);
            }

            $response = Http::timeout($this->timeout)->get(
                "{$this->baseUrl}/render/avatar/" . ($userId ?? $avatar->user_id)
            );

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }
        } catch (Throwable $e) {
            Log::error('RCCService::renderAvatar', ['error' => $e->getMessage()]);
        }

        return $this->fallbackGd($avatar);
    }

    /**
     * Render an item thumbnail (REST, not SOAP).
     */
    public function renderItem(Item $item): ?string
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
                'save'            => true,
            ]);

            if ($response->successful() && $url = $response->json('url')) {
                return $url;
            }
        } catch (Throwable $e) {
            Log::error('RCCService::renderItem', ['error' => $e->getMessage()]);
        }

        return $this->fallbackItemGd($item);
    }

    /* ── SOAP endpoint (server-to-server only) ────────────────────────────── */

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
          <xsd:element name="user_id"       type="xsd:integer"/>
          <xsd:element name="body_color"    type="xsd:string"/>
          <xsd:element name="hat_primary"   type="xsd:string" minOccurs="0"/>
          <xsd:element name="face_primary"  type="xsd:string" minOccurs="0"/>
          <xsd:element name="shirt_primary" type="xsd:string" minOccurs="0"/>
          <xsd:element name="pants_primary" type="xsd:string" minOccurs="0"/>
          <xsd:element name="shoes_primary" type="xsd:string" minOccurs="0"/>
          <xsd:element name="acc_primary"   type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderAvatarResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="thumbnail_url" type="xsd:string"/>
          <xsd:element name="success"       type="xsd:boolean"/>
          <xsd:element name="error"         type="xsd:string" minOccurs="0"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemRequest">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="item_id"          type="xsd:integer"/>
          <xsd:element name="color_primary"    type="xsd:string"/>
          <xsd:element name="color_secondary"  type="xsd:string"/>
          <xsd:element name="category"         type="xsd:string"/>
        </xsd:sequence></xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemResponse">
        <xsd:complexType><xsd:sequence>
          <xsd:element name="thumbnail_url" type="xsd:string"/>
          <xsd:element name="success"       type="xsd:boolean"/>
          <xsd:element name="error"         type="xsd:string" minOccurs="0"/>
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
      <input message="tns:RenderAvatarIn"/>
      <output message="tns:RenderAvatarOut"/>
    </operation>
    <operation name="RenderItem">
      <input message="tns:RenderItemIn"/>
      <output message="tns:RenderItemOut"/>
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

    /**
     * Handle an incoming SOAP XML body.
     *
     * Uses DOMDocument (more robust than simplexml for namespace handling),
     * with libxml_use_internal_errors so we can log the actual parse failure
     * rather than just returning a generic "Invalid XML" fault.
     *
     * All color/text values are XML-escaped before being embedded in the
     * response XML to prevent injection.
     */
    public function handleSoapRequest(string $rawBody): string
    {
        if (empty(trim($rawBody))) {
            return $this->soapFault('Client', 'Empty request body');
        }

        try {
            // Use DOMDocument — more permissive and namespace-aware than simplexml
            libxml_use_internal_errors(true);
            libxml_clear_errors();

            $dom = new \DOMDocument('1.0', 'UTF-8');
            $dom->recover = true;   // attempt recovery on minor errors

            $loaded = $dom->loadXML($rawBody, LIBXML_NOCDATA | LIBXML_NONET);

            if (!$loaded) {
                $errors = array_map(fn ($e) => trim($e->message), libxml_get_errors());
                libxml_clear_errors();
                Log::warning('RCCService::handleSoapRequest XML parse error', [
                    'errors' => $errors,
                    'body_preview' => substr($rawBody, 0, 400),
                ]);
                return $this->soapFault('Client', 'XML parse error: ' . implode('; ', array_slice($errors, 0, 2)));
            }
            libxml_clear_errors();

            $xpath = new \DOMXPath($dom);
            $xpath->registerNamespace('soap', 'http://schemas.xmlsoap.org/soap/envelope/');
            $xpath->registerNamespace('tns',  'urn:YLCRCCService');

            // Find the first child of <soap:Body>
            $bodyChildren = $xpath->query('//soap:Body/*');
            if (!$bodyChildren || $bodyChildren->length === 0) {
                return $this->soapFault('Client', 'Missing or empty SOAP Body');
            }

            $opNode  = $bodyChildren->item(0);
            $opName  = $opNode->localName ?? '';

            return match (true) {
                str_contains($opName, 'RenderAvatar') => $this->soapRenderAvatar($dom, $xpath, $opNode),
                str_contains($opName, 'RenderItem')   => $this->soapRenderItem($dom, $xpath, $opNode),
                default => $this->soapFault('Client', "Unknown operation: {$opName}"),
            };
        } catch (Throwable $e) {
            Log::error('RCCService::handleSoapRequest', ['error' => $e->getMessage()]);
            return $this->soapFault('Server', 'Internal server error');
        }
    }

    /* ── Private SOAP operation handlers ──────────────────────────────────── */

    private function soapRenderAvatar(\DOMDocument $dom, \DOMXPath $xpath, \DOMNode $opNode): string
    {
        $get = fn (string $tag) => $xpath->query(".//*[local-name()='{$tag}']", $opNode)->item(0)?->textContent ?? '';

        $userId    = (int) ($get('user_id') ?: 0);
        $bodyColor = $get('body_color') ?: '#D9D9D9';

        $slotColors = [];
        foreach (['hat', 'face', 'shirt', 'pants', 'shoes'] as $slot) {
            $p = $get("{$slot}_primary");
            if ($p) $slotColors[$slot] = ['primary' => $p, 'secondary' => $get("{$slot}_secondary")];
        }
        $acc = $get('acc_primary');
        if ($acc) $slotColors['accessory'] = ['primary' => $acc];

        $url     = $this->renderAvatarFromColors($bodyColor, $slotColors, $userId);
        $success = !empty($url);

        return $this->soapResponse('RenderAvatarResponse', [
            'thumbnail_url' => $url ?? '',
            'success'       => $success ? 'true' : 'false',
            'error'         => $success ? '' : 'Render failed',
        ]);
    }

    private function soapRenderItem(\DOMDocument $dom, \DOMXPath $xpath, \DOMNode $opNode): string
    {
        $get = fn (string $tag) => $xpath->query(".//*[local-name()='{$tag}']", $opNode)->item(0)?->textContent ?? '';

        $itemId = (int) ($get('item_id') ?: 0);
        $item   = Item::find($itemId);

        if (!$item) {
            return $this->soapFault('Client', 'Item not found');
        }

        $url     = $this->renderItem($item);
        $success = !empty($url);

        return $this->soapResponse('RenderItemResponse', [
            'thumbnail_url' => $url ?? '',
            'success'       => $success ? 'true' : 'false',
            'error'         => $success ? '' : 'Render failed',
        ]);
    }

    /* ── Health check ─────────────────────────────────────────────────────── */

    private function isAlive(): bool
    {
        try {
            return Http::timeout(3)->get("{$this->baseUrl}/health")->successful();
        } catch (Throwable) {
            return false;
        }
    }

    /* ── GD fallbacks ─────────────────────────────────────────────────────── */

    private function fallbackAvatarUrl(int $userId): ?string
    {
        try {
            $avatar = Avatar::where('user_id', $userId)->first();
            if (!$avatar) return null;
            return $this->fallbackGd($avatar);
        } catch (Throwable) {
            return null;
        }
    }

    private function fallbackGd(Avatar $avatar): ?string
    {
        try {
            return app(ThumbnailService::class)->generateAvatarThumbnail($avatar);
        } catch (Throwable $e) {
            Log::error('RCCService fallbackGd', ['error' => $e->getMessage()]);
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

    /* ── XML helpers ──────────────────────────────────────────────────────── */

    /**
     * Build a SOAP response envelope.
     * All field values are properly XML-escaped with htmlspecialchars.
     */
    private function soapResponse(string $opName, array $fields): string
    {
        $inner = '';
        foreach ($fields as $key => $value) {
            $safe   = htmlspecialchars((string) $value, ENT_XML1 | ENT_QUOTES, 'UTF-8');
            $inner .= "<tns:{$key}>{$safe}</tns:{$key}>";
        }
        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:YLCRCCService">'
            . "<soap:Body><tns:{$opName}>{$inner}</tns:{$opName}></soap:Body>"
            . '</soap:Envelope>';
    }

    private function soapFault(string $code, string $message): string
    {
        $safe = htmlspecialchars($message, ENT_XML1 | ENT_QUOTES, 'UTF-8');
        return '<?xml version="1.0" encoding="UTF-8"?>'
            . '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
            . "<soap:Body><soap:Fault><faultcode>{$code}</faultcode><faultstring>{$safe}</faultstring></soap:Fault></soap:Body>"
            . '</soap:Envelope>';
    }
}
