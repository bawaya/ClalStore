<?php
/**
 * Class WC_Gateway_Upay_Return_Handler file.
 *
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Handle Responses from Upay.
 */
class WC_Gateway_Upay_Return_Handler {
    
        /**
        * Class for dealing with an Upay payment
        *
        * @var WC_Gateway_Upay_API_Handler
        */
        protected $api;
        
	/**
	 * Constructor.
	 *
         * @param class WC_Gateway_Upay_API_Handler.
	 */
	public function __construct($api = null) {
            add_action('woocommerce_api_wc_gateway_upay', array( $this, 'check_response'));
            
            $this->api = $api;
	}

	/**
	 * Validate a Upay transaction to ensure its authentic.
	 *
	 * @param  string $transaction TX ID.
	 * @return int $orderId Order id
	 */
	protected function validate_transaction( $transaction, $orderId) {
	    return true;
            return $this->api->verifyTransaction($transaction, $orderId);
	}
        
        /**
	 * Redirect to checkout.
	 */
        public function redirect_to_checkout(){
            wc_add_notice(__('Please check the details again and consider choosing a different payment option if declined again.', 'woocommerce-gateway-upay'), 'error');            
            echo "<script>window.parent.location.href='".wc_get_checkout_url()."';</script>";
            exit;
        }
        
	/**
	 * Check Response for Upay.
	 */
	public function check_response() {
            try{
                WC_Gateway_Upay::log( 'Upay Response: ' . wc_print_r($_GET, true ) );
                
                if (!empty($_GET["errormessage"])) {
                    WC_Gateway_Upay::log($_GET["errormessage"] . ': ' . $_GET["errordescription"], 'error');
                    $this->redirect_to_checkout();
                }
                
                if(empty($_GET['providererrordescription']) || empty($_GET['transactionid']) || $_GET['providererrordescription'] != "SUCCESS"){
                    WC_Gateway_Upay::log('Upay Request Failure.', 'error');
                    $this->redirect_to_checkout();
                }
                
                $order  = $this->get_upay_order();
                
		if ( !$order) { 
                    WC_Gateway_Upay::log('Order not found.', 'error');
                    $this->redirect_to_checkout();
		}
                if (!$order->has_status('pending')) {
                    echo "<script>window.parent.location.href='".$order->get_checkout_order_received_url()."';</script>";
                    exit();
		}
                if ($order->get_transaction_id()) { 
                    WC_Gateway_Upay::log('Order has transaction id.', 'error');
                    $this->redirect_to_checkout();
		}
                
                $amount      = wc_clean(wp_unslash($_GET['amount']));
                $transaction = wc_clean(wp_unslash($_GET['transactionid']));
                
                update_post_meta( $order->get_id(), '_transaction_id', $transaction );
                
		if ($this->validate_transaction($transaction, $order->get_id())) {
                    $this->payment_complete( $order, $transaction, __( 'Upay payment completed', 'woocommerce-gateway-upay' ) );
                    echo "<script>window.parent.location.href='".$order->get_checkout_order_received_url()."';</script>";
                    exit();
                                           
		} else {
                    WC_Gateway_Upay::log( 'Received invalid response from Upay.' );
                    $this->redirect_to_checkout();
		}
            } catch (Exception $e) {
                WC_Gateway_Upay::log( 'Error: ' . $e->getMessage(), 'error' );
                $this->redirect_to_checkout();
            }
              
	}
        
        /**
	 * Get the order from the Upay 'Custom' variable.
	 *
	 * @param  string $raw_custom JSON Data passed back by Upay.
	 * @return bool|WC_Order object
	 */
	protected function get_upay_order() {

                if(empty($_GET['order_id']) || empty($_GET['order_key'])){
                    WC_Gateway_Upay::log( 'Order ID and key were not found in  array of variables $_GET.', 'error' );
                    return false;
                }
                
                $order_id  = wc_clean(wp_unslash($_GET['order_id']));
                $order_key = wc_clean(wp_unslash($_GET['order_key']));

		$order = wc_get_order( $order_id );

		if ( ! $order ) {
			// We have an invalid $order_id, probably because invoice_prefix has changed.
			$order_id = wc_get_order_id_by_order_key( $order_key );
			$order    = wc_get_order( $order_id );
		}

		if ( ! $order || $order->get_order_key() !== $order_key ) {
			WC_Gateway_Upay::log( 'Order Keys do not match.', 'error' );
			return false;
		}
                
                WC_Gateway_Upay::log( 'Found order #' . $order->get_id() );
                
		return $order;
	}

	/**
	 * Complete order, add transaction ID and note.
	 *
	 * @param  WC_Order $order Order object.
	 * @param  string   $txn_id Transaction ID.
	 * @param  string   $note Payment note.
	 */
	protected function payment_complete( $order, $txn_id = '', $note = '' ) {
            $order->add_order_note( $note );
            $order->payment_complete( $txn_id );
            WC()->cart->empty_cart();
	}
}
