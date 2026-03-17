<?php
/**
 * Upay Standard Payment Gateway.
 *
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WC_Gateway_Upay Class.
 */
class WC_Gateway_Upay extends WC_Payment_Gateway {

    /**
     * Whether or not logging is enabled
     *
     * @var bool
     */
    public static $log_enabled = false;

    /**
     * Logger instance
     *
     * @var WC_Logger
     */
    public static $log = false;
    
    /**
    * Class for dealing with an Upay payment
    *
    * @var WC_Gateway_Upay_API_Handler
    */
    protected $api;
        
    /**
     * Constructor for the gateway.
     */
    public function __construct() {
        // The global ID for this Payment method
        $this->id = 'upay';

        //Set if the place order button should be renamed on selection.
        $this->order_button_text = $this->get_option('button_text') ?: __('Proceed to Upay', 'woocommerce-gateway-upay');
        
        // The Title shown on the top of the Payment Gateways Page next to all the other Payment Gateways
        $this->method_title = __('Upay', 'woocommerce-gateway-upay');
        
        // The description for this Payment Gateway, shown on the actual Payment options page on the backend
        $this->method_description = __('Upay Payment redirects customers to Upay to enter their payment information.', 'woocommerce-gateway-upay');
        
        // Bool. Can be set to true if you want payment fields to show on the checkout 
        // if doing a direct integration, which we are doing in this case
        $this->has_fields = false;
        
        // Load the settings.
        $this->init_form_fields();
        $this->init_settings();
        
        // Define user set variables.
        $this->title = $this->get_option('title');
        $this->description = $this->get_option('description');
        $this->numberpayments = $this->get_option('numberpayments') ?: 1;
        $this->language = $this->get_option('language') ?: 'HE';
        $this->show_icon = 'yes' === $this->get_option('show_icon', 'no');
        $this->height_desktop = $this->get_option('height_desktop');
        $this->height_mobile = $this->get_option('height_mobile');
        $this->icon_url = $this->get_option('selected_icon');
        $this->testmode = 'yes' === $this->get_option('testmode', 'no');
        $this->debug = 'yes' === $this->get_option('debug', 'no');
        $this->what_is_upay_url = $this->get_option('what_is_upay_url');
        $this->what_is_upay_link_text = $this->get_option('what_is_upay_link_text');
        $this->api_username = $this->get_option('api_username');
        $this->api_key = $this->get_option('api_key');
        self::$log_enabled = $this->debug;
        
        $this->endpoint_url = 'https://app.upay.co.il/API6/clientsecure/redirectpage.php';
         
        if ($this->testmode) {
            $this->description .= ' ' . __('SANDBOX ENABLED.', 'woocommerce-gateway-upay');
            $this->description = trim($this->description);
        }
        
        // Save settings
        if (is_admin()) {
            if (version_compare(WOOCOMMERCE_VERSION, '2.0.0', '>=')) {
                add_action('woocommerce_update_options_payment_gateways_' . $this->id, array($this, 'process_admin_options'));
            } else {
                add_action('woocommerce_update_options_payment_gateways', array($this, 'process_admin_options'));
            }
        } 
        
        add_action('woocommerce_receipt_upay', array(&$this, 'receipt_page'));
        
        //Init the API class
        $this->init_api();
        
        if (!$this->is_valid_for_use()) {
            $this->enabled = 'no';
        } else {
            include_once dirname(__FILE__) . '/class-wc-gateway-upay-return-handler.php';
            new WC_Gateway_Upay_Return_Handler($this->api);
        }
    }
    
   
    /**
     * Return whether or not this gateway still requires setup to function.
     *
     * When this gateway is toggled on via AJAX, if this returns true a
     * redirect will occur to the settings page instead.
     *
     * @since 3.4.0
     * @return bool
     */
    public function needs_setup() {
        return !(empty($this->get_option('api_username')) || empty($this->get_option('api_key')));
    }
    
   /**
    * Checks to see if all criteria is met before showing payment method.
    *
    * @since 4.0.0
    * @version 4.0.0
    * @return bool
    */
    public function is_available() {
        if ('yes' !== $this->enabled) {
            return false;
        }

        if (!$this->api_key || !$this->api_username) {
            return false;
        }
        
        if (!$this->is_valid_for_use()) {
            return false;
        }
        
        return true;
    }

    /**
     * Logging method.
     *
     * @param string $message Log message.
     * @param string $level Optional. Default 'info'. Possible values:
     *                      emergency|alert|critical|error|warning|notice|info|debug.
     */
    public static function log($message, $level = 'info') {
        if (self::$log_enabled) {
            if (empty(self::$log)) {
                self::$log = wc_get_logger();
            }
            self::$log->log($level, $message, array('source' => 'upay'));
        }
    }

    /**
     * Processes and saves options.
     * If there is an error thrown, will continue to save and validate fields, but will leave the erroring field out.
     *
     * @return bool was anything saved?
     */
    public function process_admin_options() {
        $saved = parent::process_admin_options();

        // Maybe clear logs.
        if ('yes' !== $this->get_option('debug', 'no')) {
            if (empty(self::$log)) {
                self::$log = wc_get_logger();
            }
            self::$log->clear('upay');
        }

        return $saved;
    }

    /**
     * Get gateway icon.
     *
     * @return string
     */
    public function get_icon() {
        $icon_html = '';
        
        if($this->show_icon){
            $icon = (array) $this->get_icon_image();
            foreach ($icon as $i) {
                $icon_html .= '<img src="' . esc_attr($i) . '" alt="' . esc_attr__('Upay acceptance mark', 'woocommerce-gateway-upay') . '" />';
            }
        }

        if($this->what_is_upay_url){
            $icon_html .= sprintf('<a href="%1$s" class="about_upay" onclick="javascript:window.open(\'%1$s\',\'WIUpay\',\'toolbar=no, location=no, directories=no, status=no, menubar=no, scrollbars=yes, resizable=yes, width=1060, height=700\'); return false;">' . ($this->what_is_upay_link_text ?: esc_attr__('What is Upay?', 'woocommerce-gateway-upay')) . '</a>', esc_url($this->what_is_upay_url));
        } else{
            $icon_html .= $this->what_is_upay_link_text;
        }
        
        return apply_filters('woocommerce_gateway_icon', $icon_html, $this->id);
    }

    /**
     * Get Upay images for a country.
     *
     * @param string $country Country code.
     * @return array of image URLs
     */
    protected function get_icon_image() {
        if ($this->icon_url != '') $icon_url = $this->icon_url;
        else $icon_url = WC_UPAY_PLUGIN_URL . '/assets/images/upay.jpg';

        return apply_filters('woocommerce_upay_icon', $icon_url);
    }

    /**
     * Check if this gateway is enabled and available in the user's country.
     *
     * @return bool
     */
    public function is_valid_for_use() {
        return in_array(
                get_woocommerce_currency(),
                apply_filters(
                    'woocommerce_upay_supported_currencies',
                    array('ILS', 'USD')
                ),
                true
        );
    }

    /**
     * Admin Panel Options.
     * - Options for bits like 'title' and availability on a country-by-country basis.
     *
     */
    public function admin_options() {
        if ($this->is_valid_for_use()) {
            parent::admin_options();
        } else {
            ?>
                <div class="inline error">
                    <p>
                        <strong><?php esc_html_e('Gateway disabled', 'woocommerce-gateway-upay'); ?></strong>: <?php esc_html_e('Upay does not support your store currency.', 'woocommerce-gateway-upay'); ?>
                    </p>
                </div>
            <?php
        }
    }

    /**
     * Initialise Gateway Settings Form Fields.
     */
    public function init_form_fields() {
        $this->form_fields = include 'settings-upay.php';
    }

    /**
     * Process the payment and return the result.
     *
     * @param  int $order_id Order ID.
     * @return array
     */
    public function process_payment($order_id) {
        $order = new WC_Order($order_id);

        return array(
            'result' => 'success',
            'redirect' => $order->get_checkout_payment_url(true)
        );
    }

    /**
     * Init the API class and set the api username/key etc.
     */
    protected function init_api() {
        include_once dirname(__FILE__) . '/class-wc-gateway-upay-api-handler.php';
        $this->api = new WC_Gateway_Upay_API_Handler($this->api_username, $this->api_key, $this->testmode, $this->numberpayments, $this->language);  
    }
    
    /**
     * Receipt Page
     * 
     */
    function receipt_page($order_id) {
        $order = new WC_Order($order_id);
        $url = $this->api->getRedirectUrl($order);
        if($url){
            $height = (wp_is_mobile()) ? $this->height_mobile : $this->height_desktop;
            echo '<iframe class="intrinsic-ignore" src="'.$url.'" name="upayIframe" style="width:100%;height:'. $height .'px;border:none;"></iframe>';
        } else {
            echo '<p>There was error processing the payment.</p>';
        }        
    }
    
    /**
     * Generate upay.net button link
     * */
    public function generate_upay_form($order_id) {

        global $woocommerce;

        $order = new WC_Order($order_id);

        $data = array();
        $data["email"] = $this->api_username;
        $data["emailnotify"] = $order->billing_email;
        
        if (strpos($order->billing_phone, '05') === 0 || strpos($order->billing_phone, '+9725') === 0){
            $data["cellphonenotify"] = $order->billing_phone;
        }
        
        $data["comment"] = __('Order #', 'woocommerce-gateway-upay') . $order->get_order_number();
        $data["paymentdetails"] = __('Order #', 'woocommerce-gateway-upay') . $order->get_order_number();
        $data["livesystem"] = $this->testmode ? 0 : 1;
        $data["maxpayments"] = 1;
        $data["amount"] = $order->get_total();	
        $data["templatenumber"] = 15;
        
        $data["returnurl"] = add_query_arg(array('order_id'=> $order->get_id(), 'order_key'=>$order->get_order_key() ), $woocommerce->api_request_url('WC_Gateway_Upay'));
        
        foreach ($data as $key => $value) {
            $data_array[] = "<input type='hidden' name='$key' value='$value'/>";
        }

        $html_form = '<form action="' . $this->endpoint_url . '" method="post" id="upay_payment_form" target="upayIframe">'
                . implode('', $data_array)                
                . '<script type="text/javascript">
                 jQuery(function(){                
                jQuery("#upay_payment_form").submit(); 
              });
              </script>
              </form>';

        return $html_form;
    }
}
