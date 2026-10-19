<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Creates the API user and key the MTN MoMo sandbox needs. Live keys come from
 * MTN at go-live, so this only works against the sandbox.
 */
class CreateMomoSandboxUser extends Command
{
    protected $signature = 'momo:sandbox-user {--callback-host=ituze.test : Host MTN may call back}';

    protected $description = 'Create an MTN MoMo sandbox API user and key (needs MTN_MOMO_SUBSCRIPTION_KEY).';

    public function handle(): int
    {
        $config = config('services.mobile_money.mtn');
        if (empty($config['subscription_key'])) {
            $this->error('Set MTN_MOMO_SUBSCRIPTION_KEY first (Collections primary key from momodeveloper.mtn.com).');

            return self::FAILURE;
        }
        if (! str_contains($config['base_url'], 'sandbox')) {
            $this->error('This command only works with the sandbox. Live API keys are issued by MTN.');

            return self::FAILURE;
        }

        $apiUser = (string) Str::uuid();
        $client = Http::baseUrl($config['base_url'])->timeout(20)
            ->withHeaders(['Ocp-Apim-Subscription-Key' => $config['subscription_key']]);

        $created = $client->withHeaders(['X-Reference-Id' => $apiUser])
            ->post('/v1_0/apiuser', ['providerCallbackHost' => $this->option('callback-host')]);
        if ($created->status() !== 201) {
            $this->error('MTN refused to create the API user ('.$created->status().'). Check the subscription key.');

            return self::FAILURE;
        }

        $key = $client->post("/v1_0/apiuser/{$apiUser}/apikey");
        if (! $key->successful() || ! $key->json('apiKey')) {
            $this->error('MTN created the user but did not return an API key ('.$key->status().').');

            return self::FAILURE;
        }

        $this->info('Sandbox API user created. Add these lines to your .env file:');
        $this->line('MOBILE_MONEY_DRIVER=mtn');
        $this->line('MTN_MOMO_API_USER='.$apiUser);
        $this->line('MTN_MOMO_API_KEY='.$key->json('apiKey'));

        return self::SUCCESS;
    }
}
