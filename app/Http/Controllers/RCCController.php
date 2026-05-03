<?php

namespace App\Http\Controllers;

use App\Services\RCCService;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;
use Throwable;

class RCCController extends Controller
{
    public function __construct(private RCCService $rcc) {}

    /**
     * Serve the WSDL definition.
     */
    public function wsdl(Request $request): Response
    {
        $serviceUrl = route('rcc.soap');
        $wsdl       = $this->rcc->wsdl($serviceUrl);

        return response($wsdl, 200, [
            'Content-Type'  => 'text/xml; charset=UTF-8',
            'Cache-Control' => 'public, max-age=3600',
        ]);
    }

    /**
     * Handle incoming SOAP requests.
     */
    public function handle(Request $request): Response
    {
        try {
            // Validate content-type loosely
            $contentType = $request->header('Content-Type', '');
            if (!str_contains($contentType, 'xml') && !str_contains($contentType, 'soap')) {
                return response($this->soapFault('Client', 'Expected XML/SOAP content-type'), 400, [
                    'Content-Type' => 'text/xml; charset=UTF-8',
                ]);
            }

            $body = $request->getContent();
            if (empty($body)) {
                return response($this->soapFault('Client', 'Empty request body'), 400, [
                    'Content-Type' => 'text/xml; charset=UTF-8',
                ]);
            }

            $responseXml = $this->rcc->handleSoapRequest($body);

            return response($responseXml, 200, [
                'Content-Type' => 'text/xml; charset=UTF-8',
            ]);
        } catch (Throwable $e) {
            Log::error('RCCController::handle error', ['error' => $e->getMessage()]);
            return response($this->soapFault('Server', 'Internal server error'), 500, [
                'Content-Type' => 'text/xml; charset=UTF-8',
            ]);
        }
    }

    private function soapFault(string $code, string $message): string
    {
        $safe = htmlspecialchars($message, ENT_XML1);
        return "<?xml version=\"1.0\" encoding=\"UTF-8\"?><soap:Envelope xmlns:soap=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap:Body><soap:Fault><faultcode>{$code}</faultcode><faultstring>{$safe}</faultstring></soap:Fault></soap:Body></soap:Envelope>";
    }
}
