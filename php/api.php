<?php
declare(strict_types=1);

/**
 * Stock Tracker PRO - Standalone PHP JSON API Endpoint
 * Provides aggregated portfolio data, Stage 1, Stage 2 and Stage 3 metrics in JSON format.
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function loadJson(string $filename): array {
    $searchPaths = [
        __DIR__ . '/../public/data/' . $filename,
        __DIR__ . '/data/' . $filename,
        dirname(__DIR__) . '/public/data/' . $filename,
    ];
    foreach ($searchPaths as $path) {
        if (file_exists($path) && is_readable($path)) {
            $content = file_get_contents($path);
            if ($content !== false) {
                $decoded = json_decode($content, true);
                if (is_array($decoded)) {
                    return $decoded;
                }
            }
        }
    }
    return [];
}

$response = [
    'status' => 'success',
    'timestamp' => date('c'),
    'portfolio' => loadJson('portfolio.json'),
    'meta' => loadJson('meta.json'),
    'quantMetrics' => loadJson('quant_metrics.json'),
    'forecast' => loadJson('forecast.json'),
    'dividends' => loadJson('dividends.json')
];

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
