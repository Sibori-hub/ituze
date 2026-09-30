<?php

$rwandaVatRate = filter_var(env('RWANDA_VAT_RATE', 18), FILTER_VALIDATE_FLOAT);

if ($rwandaVatRate === false || $rwandaVatRate < 0 || $rwandaVatRate > 100) {
    throw new InvalidArgumentException('RWANDA_VAT_RATE must be a number between 0 and 100.');
}

return [
    'rwanda_vat_rate' => $rwandaVatRate,
];
