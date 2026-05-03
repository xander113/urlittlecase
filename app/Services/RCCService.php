<?php

namespace App\Services;

use App\Models\Avatar;
use App\Models\Item;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * RCCService — web-based SOAP avatar rendering service.
 *
 * Exposes a SOAP endpoint that accepts an avatar configuration and returns
 * a PNG thumbnail URL. Uses ThumbnailService under the hood.
 * Register at routes/web.php → Route::post('/rcc/soap', [RCCController::class, 'handle'])
 */
class RCCService
{
    private ThumbnailService $thumbnails;

    public function __construct(ThumbnailService $thumbnails)
    {
        $this->thumbnails = $thumbnails;
    }

    /**
     * Generate WSDL XML document for the RCC SOAP service.
     */
    public function wsdl(string $serviceUrl): string
    {
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<definitions name="YLCRCCService"
    targetNamespace="urn:YLCRCCService"
    xmlns="http://schemas.xmlsoap.org/wsdl/"
    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
    xmlns:tns="urn:YLCRCCService"
    xmlns:xsd="http://www.w3.org/2001/XMLSchema">

  <types>
    <xsd:schema targetNamespace="urn:YLCRCCService">
      <xsd:element name="RenderAvatarRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="user_id"    type="xsd:integer"/>
            <xsd:element name="body_color" type="xsd:string"/>
            <xsd:element name="hat_id"     type="xsd:integer" minOccurs="0"/>
            <xsd:element name="face_id"    type="xsd:integer" minOccurs="0"/>
            <xsd:element name="shirt_id"   type="xsd:integer" minOccurs="0"/>
            <xsd:element name="pants_id"   type="xsd:integer" minOccurs="0"/>
            <xsd:element name="shoes_id"   type="xsd:integer" minOccurs="0"/>
            <xsd:element name="accessory_id" type="xsd:integer" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderAvatarResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="thumbnail_url" type="xsd:string"/>
            <xsd:element name="success"       type="xsd:boolean"/>
            <xsd:element name="error"         type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemRequest">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="item_id" type="xsd:integer"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
      <xsd:element name="RenderItemResponse">
        <xsd:complexType>
          <xsd:sequence>
            <xsd:element name="thumbnail_url" type="xsd:string"/>
            <xsd:element name="success"       type="xsd:boolean"/>
            <xsd:element name="error"         type="xsd:string" minOccurs="0"/>
          </xsd:sequence>
        </xsd:complexType>
      </xsd:element>
    </xsd:schema>
  </types>

  <message name="RenderAvatarInput">
    <part name="parameters" element="tns:RenderAvatarRequest"/>
  </message>
  <message name="RenderAvatarOutput">
    <part name="parameters" element="tns:RenderAvatarResponse"/>
  </message>
  <message name="RenderItemInput">
    <part name="parameters" element="tns:RenderItemRequest"/>
  </message>
  <message name="RenderItemOutput">
    <part name="parameters" element="tns:RenderItemResponse"/>
  </message>

  <portType name="YLCRCCPortType">
    <operation name="RenderAvatar">
      <input  message="tns:RenderAvatarInput"/>
      <output message="tns:RenderAvatarOutput"/>
    </operation>
    <operation name="RenderItem">
      <input  message="tns:RenderItemInput"/>
      <output message="tns:RenderItemOutput"/>
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
     * Process an incoming SOAP XML body and dispatch the correct operation.
     * Returns a SOAP XML response string.
     */
    public function handleSoapRequest(string $rawBody): string
    {
        try {
            $xml = @simplexml_load_string($rawBody, 'SimpleXMLElement', LIBXML_NOCDATA);

            if ($xml === false) {
                return $this->soapFault('Client', 'Invalid XML body');
            }

            $xml->registerXPathNamespace('soap', 'http://schemas.xmlsoap.org/soap/envelope/');
            $xml->registerXPathNamespace('tns',  'urn:YLCRCCService');

            $body = $xml->xpath('//soap:Body')[0] ?? null;
            if (!$body) {
                return $this->soapFault('Client', 'Missing SOAP Body');
            }

            // Detect operation
            $children = $body->children('urn:YLCRCCService');
            $operation = null;
            $params    = null;

            foreach ($children as $name => $child) {
                $operation = $name;
                $params    = $child;
                break;
            }

            if (!$operation) {
                // Try without namespace
                foreach ($body->children() as $name => $child) {
                    $operation = $name;
                    $params    = $child;
                    break;
                }
            }

            return match ($operation) {
                'RenderAvatarRequest', 'RenderAvatar' => $this->renderAvatar($params),
                'RenderItemRequest',   'RenderItem'   => $this->renderItem($params),
                default => $this->soapFault('Client', "Unknown operation: {$operation}"),
            };
        } catch (Throwable $e) {
            Log::error('RCCService::handleSoapRequest error', ['error' => $e->getMessage()]);
            return $this->soapFault('Server', 'Internal server error');
        }
    }

    // ─── Operation Handlers ──────────────────────────────────────────────────

    private function renderAvatar(?\SimpleXMLElement $params): string
    {
        try {
            if (!$params) {
                return $this->soapFault('Client', 'Missing parameters');
            }

            $userId    = (int) ($params->user_id ?? 0);
            $bodyColor = (string) ($params->body_color ?? '#f5cba7');

            if (!$userId) {
                return $this->soapFault('Client', 'user_id is required');
            }

            // Build a transient Avatar model from the request
            $avatar = new Avatar([
                'user_id'              => $userId,
                'body_color'           => $bodyColor,
                'hat_user_item_id'     => isset($params->hat_id)       ? (int) $params->hat_id       : null,
                'face_user_item_id'    => isset($params->face_id)      ? (int) $params->face_id      : null,
                'shirt_user_item_id'   => isset($params->shirt_id)     ? (int) $params->shirt_id     : null,
                'pants_user_item_id'   => isset($params->pants_id)     ? (int) $params->pants_id     : null,
                'shoes_user_item_id'   => isset($params->shoes_id)     ? (int) $params->shoes_id     : null,
                'accessory_user_item_id' => isset($params->accessory_id) ? (int) $params->accessory_id : null,
            ]);

            $path = $this->thumbnails->generateAvatarThumbnail($avatar);
            $url  = $path ? Storage::disk('public')->url($path) : '';

            return $this->soapResponse('RenderAvatarResponse', [
                'thumbnail_url' => $url,
                'success'       => $path ? 'true' : 'false',
                'error'         => $path ? '' : 'Thumbnail generation failed',
            ]);
        } catch (Throwable $e) {
            Log::error('RCCService::renderAvatar error', ['error' => $e->getMessage()]);
            return $this->soapFault('Server', 'Avatar render failed');
        }
    }

    private function renderItem(?\SimpleXMLElement $params): string
    {
        try {
            if (!$params) {
                return $this->soapFault('Client', 'Missing parameters');
            }

            $itemId = (int) ($params->item_id ?? 0);
            $item   = Item::find($itemId);

            if (!$item) {
                return $this->soapFault('Client', 'Item not found');
            }

            $url = $this->thumbnails->generateItemThumbnail($item);

            return $this->soapResponse('RenderItemResponse', [
                'thumbnail_url' => $url ?? '',
                'success'       => $url ? 'true' : 'false',
                'error'         => $url ? '' : 'Item thumbnail generation failed',
            ]);
        } catch (Throwable $e) {
            Log::error('RCCService::renderItem error', ['error' => $e->getMessage()]);
            return $this->soapFault('Server', 'Item render failed');
        }
    }

    // ─── SOAP XML Helpers ─────────────────────────────────────────────────────

    private function soapResponse(string $operationName, array $fields): string
    {
        $inner = '';
        foreach ($fields as $key => $value) {
            $safeVal = htmlspecialchars((string) $value, ENT_XML1 | ENT_COMPAT, 'UTF-8');
            $inner  .= "<tns:{$key}>{$safeVal}</tns:{$key}>";
        }

        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="urn:YLCRCCService">
  <soap:Body>
    <tns:{$operationName}>{$inner}</tns:{$operationName}>
  </soap:Body>
</soap:Envelope>
XML;
    }

    private function soapFault(string $code, string $message): string
    {
        $safeMsg = htmlspecialchars($message, ENT_XML1 | ENT_COMPAT, 'UTF-8');
        return <<<XML
<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <soap:Fault>
      <faultcode>{$code}</faultcode>
      <faultstring>{$safeMsg}</faultstring>
    </soap:Fault>
  </soap:Body>
</soap:Envelope>
XML;
    }
}
